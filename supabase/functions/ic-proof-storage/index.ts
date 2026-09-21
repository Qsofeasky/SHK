import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bucketName = "ic-proofs";
const maxUploadBytes = 700_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SHK_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SHK_SERVICE_ROLE_KEY.");
    }

    const body = await req.json();
    const action = String(body.action || "upload");
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "signed-url") {
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
      if (adminError || isAdmin !== true) {
        return json({ error: "Admin access required." }, 403);
      }

      const path = String(body.path || "");
      if (!path) throw new Error("Missing IC proof path.");

      const { data, error } = await adminClient.storage
        .from(bucketName)
        .createSignedUrl(path, 60 * 10);
      if (error) throw error;

      return json({ signed_url: data.signedUrl });
    }

    await ensureBucket(adminClient);

    const fileName = safeFileName(body.fileName || "gambar-ic.png");
    const mimeType = String(body.mimeType || "image/png");
    const dataUrl = String(body.dataUrl || "");

    if (!mimeType.startsWith("image/")) {
      throw new Error("Hanya fail gambar IC dibenarkan.");
    }

    const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop() || "" : dataUrl;
    const bytes = base64ToUint8Array(base64);

    if (!bytes.length) {
      throw new Error("Gambar IC tidak sah.");
    }

    if (bytes.byteLength > maxUploadBytes) {
      throw new Error("Saiz gambar IC maksimum 700KB. Sila compress gambar dahulu.");
    }

    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await adminClient.storage
      .from(bucketName)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    return json({
      bucket: bucketName,
      path,
      file_name: fileName,
    });
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});

async function ensureBucket(adminClient) {
  const { data: buckets, error: bucketListError } = await adminClient.storage.listBuckets();
  if (bucketListError) throw bucketListError;

  const hasBucket = buckets?.some((bucket) => bucket.name === bucketName);
  if (!hasBucket) {
    const { error: createBucketError } = await adminClient.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: maxUploadBytes,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    });
    if (createBucketError) throw createBucketError;
  }
}

function safeFileName(value: string) {
  return String(value)
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "gambar-ic.png";
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
