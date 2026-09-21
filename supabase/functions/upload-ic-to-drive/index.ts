const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const maxUploadBytes = 1_500_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
    const privateKey = normalizePrivateKey(Deno.env.get("GOOGLE_PRIVATE_KEY") || "");
    const folderId = Deno.env.get("GOOGLE_DRIVE_IC_FOLDER_ID") || "";
    const makePublic = (Deno.env.get("GOOGLE_DRIVE_MAKE_PUBLIC") || "").toLowerCase() === "true";

    if (!serviceAccountEmail || !privateKey || !folderId) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_DRIVE_IC_FOLDER_ID.");
    }

    const body = await req.json();
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
      throw new Error("Saiz gambar IC maksimum 1.5MB.");
    }

    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);
    const metadata = {
      name: `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}-${fileName}`,
      parents: [folderId],
    };
    const boundary = `shk-${crypto.randomUUID()}`;
    const multipartBody = createMultipartBody(boundary, metadata, mimeType, bytes);

    const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!uploadResponse.ok) {
      throw new Error(await uploadResponse.text() || "Google Drive upload gagal.");
    }

    const uploaded = await uploadResponse.json();

    if (makePublic) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      });
    }

    return json({
      file_id: uploaded.id,
      file_name: uploaded.name,
      web_view_link: uploaded.webViewLink,
      web_content_link: uploaded.webContentLink,
    });
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
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

function createMultipartBody(boundary: string, metadata: Record<string, unknown>, mimeType: string, bytes: Uint8Array) {
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  );
  const fileHeader = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(metadataPart.length + fileHeader.length + bytes.length + closing.length);
  body.set(metadataPart, 0);
  body.set(fileHeader, metadataPart.length);
  body.set(bytes, metadataPart.length + fileHeader.length);
  body.set(closing, metadataPart.length + fileHeader.length + bytes.length);
  return body;
}

async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const jwt = `${unsignedJwt}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Google access token gagal.");
  }

  const token = await response.json();
  return token.access_token;
}

function base64UrlJson(payload: Record<string, unknown>) {
  return base64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  return base64ToUint8Array(base64).buffer;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
