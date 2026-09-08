import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SHK_SERVICE_ROLE_KEY") || "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const cronSecret = Deno.env.get("REMINDER_CRON_SECRET") || "";
    const mailFrom = Deno.env.get("MAIL_FROM") || "Surau Hj Kamaruddin <onboarding@resend.dev>";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, SHK_SERVICE_ROLE_KEY, or RESEND_API_KEY.");
    }

    const requestCronSecret = req.headers.get("x-shk-cron-secret") || "";
    const hasCronAccess = cronSecret !== "" && requestCronSecret === cronSecret;

    if (!hasCronAccess) {
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
      if (adminError || isAdmin !== true) {
        return json({ error: "Admin access required." }, 403);
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const queued = await queueUnpaidMemberReminders(adminClient);
    const { data: reminders, error } = await adminClient
      .from("reminder_queue")
      .select("*")
      .eq("status", "pending")
      .not("recipient_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders || []) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: mailFrom,
          to: reminder.recipient_email,
          subject: reminder.subject || "Peringatan Bayaran Khairat",
          text: reminder.message || "Sila semak status bayaran khairat anda.",
        }),
      });

      if (response.ok) {
        sent += 1;
        await adminClient
          .from("reminder_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
      } else {
        failed += 1;
        await adminClient
          .from("reminder_queue")
          .update({ status: "failed" })
          .eq("id", reminder.id);
      }
    }

    return json({ queued, sent, failed });
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});

async function queueUnpaidMemberReminders(adminClient) {
  const year = new Date().getFullYear();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data: members, error: memberError } = await adminClient
    .from("members")
    .select("member_no, member_name, email")
    .eq("membership_status", "aktif")
    .not("email", "is", null)
    .limit(1000);
  if (memberError) throw memberError;

  const { data: payments, error: paymentError } = await adminClient
    .from("member_yearly_payments")
    .select("member_no, member_name")
    .eq("payment_year", year)
    .limit(1000);
  if (paymentError) throw paymentError;

  const paidKeys = new Set((payments || []).flatMap((payment) => [
    normalKey(payment.member_no),
    normalKey(payment.member_name),
  ]).filter(Boolean));

  const unpaidMembers = (members || []).filter((member) => {
    return !paidKeys.has(normalKey(member.member_no))
      && !paidKeys.has(normalKey(member.member_name));
  });

  if (!unpaidMembers.length) return 0;

  const emails = unpaidMembers.map((member) => member.email).filter(Boolean);
  const { data: recentReminders, error: reminderError } = await adminClient
    .from("reminder_queue")
    .select("recipient_email")
    .eq("reminder_type", "user_unpaid")
    .in("recipient_email", emails)
    .in("status", ["pending", "sent"])
    .gte("created_at", cutoff.toISOString());
  if (reminderError) throw reminderError;

  const recentlyQueued = new Set((recentReminders || []).map((reminder) => normalKey(reminder.recipient_email)));
  const remindersToInsert = unpaidMembers
    .filter((member) => !recentlyQueued.has(normalKey(member.email)))
    .map((member) => ({
      reminder_type: "user_unpaid",
      recipient_email: member.email,
      recipient_name: member.member_name,
      subject: `Peringatan Bayaran Khairat ${year}`,
      message: `Assalamualaikum ${member.member_name || ""}. Rekod menunjukkan bayaran khairat tahun ${year} belum diterima. Sila abaikan mesej ini jika bayaran sudah dibuat dan sedang menunggu pengesahan AJK.`,
    }));

  if (!remindersToInsert.length) return 0;

  const { error: insertError } = await adminClient
    .from("reminder_queue")
    .insert(remindersToInsert);
  if (insertError) throw insertError;

  return remindersToInsert.length;
}

function normalKey(value) {
  return String(value || "").trim().toLowerCase();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
