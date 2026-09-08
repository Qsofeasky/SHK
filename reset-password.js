const resetConfig = {
  url: window.SHK_SUPABASE?.url || "",
  anonKey: window.SHK_SUPABASE?.anonKey || ""
};

const resetForm = document.querySelector("#resetPasswordForm");
const resetMessage = document.querySelector("#resetMessage");

function setResetMessage(text, type = "neutral") {
  if (!resetMessage) return;
  resetMessage.textContent = text;
  resetMessage.className = `form-message form-message--${type}`;
}

function hashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function recoveryAccessToken() {
  const params = hashParams();
  if (params.get("error")) {
    throw new Error(params.get("error_description") || "Link recovery tidak sah atau sudah expired.");
  }

  const type = params.get("type");
  const token = params.get("access_token");
  if (type !== "recovery" || !token) {
    throw new Error("Buka page ini daripada link recovery Supabase yang terbaru.");
  }

  return token;
}

if (resetForm) {
  try {
    recoveryAccessToken();
    setResetMessage("Masukkan password baru untuk admin website.", "neutral");
  } catch (error) {
    setResetMessage(error.message, "error");
  }

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      if (!resetConfig.url.startsWith("https://") || !resetConfig.anonKey.startsWith("eyJ")) {
        throw new Error("Supabase config belum lengkap. Semak supabase-config.js.");
      }

      const password = document.querySelector("#newPassword").value;
      const confirmPassword = document.querySelector("#confirmPassword").value;
      if (password !== confirmPassword) {
        throw new Error("Password baru dan ulang password tidak sama.");
      }

      const response = await fetch(`${resetConfig.url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: resetConfig.anonKey,
          Authorization: `Bearer ${recoveryAccessToken()}`
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Password gagal dikemaskini.");
      }

      window.location.hash = "";
      resetForm.reset();
      setResetMessage("Password berjaya dikemaskini. Sila login semula di admin.", "success");
    } catch (error) {
      setResetMessage(error.message, "error");
    }
  });
}
