import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const backupTables = [
  "members",
  "member_dependants",
  "member_yearly_payments",
  "inactive_members",
  "membership_checks",
  "dependant_updates",
  "dependant_update_items",
  "payments",
  "non_member_donations",
  "reminder_queue",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SHK_SERVICE_ROLE_KEY") || "";
    const cronSecret = Deno.env.get("BACKUP_CRON_SECRET") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SHK_SERVICE_ROLE_KEY.");
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
    const backup: Record<string, unknown[]> = {};

    for (const table of backupTables) {
      const { data, error } = await adminClient.from(table).select("*");
      if (error) throw error;
      backup[table] = data || [];
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `shk-backup-${timestamp}.json`;
    const path = `database/${backupName}`;
    const file = new Blob([JSON.stringify({ created_at: new Date().toISOString(), backup }, null, 2)], {
      type: "application/json",
    });

    const { error: uploadError } = await adminClient.storage
      .from("database-backups")
      .upload(path, file, { contentType: "application/json", upsert: false });
    if (uploadError) throw uploadError;

    await adminClient.from("database_backups").insert({
      backup_name: backupName,
      backup_url: path,
      notes: "Auto backup from Edge Function",
      created_by: "edge-function",
    });

    return json({ backup_name: backupName, path });
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
