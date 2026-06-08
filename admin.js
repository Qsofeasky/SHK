const adminState = {
  accessToken: sessionStorage.getItem("shkAdminToken") || "",
  userEmail: sessionStorage.getItem("shkAdminEmail") || ""
};

const config = {
  url: window.SHK_SUPABASE?.url || "",
  anonKey: window.SHK_SUPABASE?.anonKey || ""
};

const loginForm = document.querySelector("#loginForm");
const adminPanel = document.querySelector("#adminPanel");

if (adminState.accessToken) {
  showAdmin();
  loadAdminData().catch(showAdminError);
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminMessage("#loginMessage", "Sedang login...", "neutral");

  try {
    if (!config.url.startsWith("https://") || !config.anonKey.startsWith("eyJ")) {
      throw new Error("Supabase config belum lengkap. Semak supabase-config.js.");
    }

    const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey
      },
      body: JSON.stringify({
        email: document.querySelector("#adminEmail").value.trim(),
        password: document.querySelector("#adminPassword").value
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(readSupabaseError(errorText) || "Login gagal. Semak email/password Supabase Auth.");
    }

    const session = await response.json();
    adminState.accessToken = session.access_token;
    adminState.userEmail = session.user?.email || "";
    sessionStorage.setItem("shkAdminToken", adminState.accessToken);
    sessionStorage.setItem("shkAdminEmail", adminState.userEmail);
    showAdmin();
    await loadAdminData();
    setAdminMessage("#loginMessage", "Login berjaya.", "success");
  } catch (error) {
    setAdminMessage("#loginMessage", error.message, "error");
  }
});

document.querySelector("#refreshAdmin")?.addEventListener("click", () => {
  loadAdminData().catch(showAdminError);
});
document.querySelector("#statusFilter")?.addEventListener("change", () => {
  loadAdminData().catch(showAdminError);
});
document.querySelector("#logoutAdmin")?.addEventListener("click", () => {
  sessionStorage.removeItem("shkAdminToken");
  sessionStorage.removeItem("shkAdminEmail");
  location.reload();
});

function showAdmin() {
  adminPanel.hidden = false;
}

async function loadAdminData() {
  await checkAdminAccess();
  await Promise.all([
    loadMembershipChecks(),
    loadDependantUpdates(),
    loadPayments()
  ]);
}

async function checkAdminAccess() {
  const result = await supabaseRpc("is_admin");
  const isAdmin = result === true || result === "true";
  const email = adminState.userEmail || "admin";

  if (!isAdmin) {
    throw new Error(`Login berjaya sebagai ${email}, tetapi email ini belum ada dalam table admin_users.`);
  }

  setAdminMessage("#adminStatus", `Login admin aktif: ${email}`, "success");
}

async function supabaseRpc(functionName, payload = {}) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${adminState.accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(readSupabaseError(message) || message || "Tidak dapat semak admin access.");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function showAdminError(error) {
  setAdminMessage("#adminStatus", error.message, "error");
  renderCards("#membershipList", [], renderMembershipCard);
  renderCards("#dependantList", [], renderDependantCard);
  renderCards("#paymentList", [], renderPaymentCard);
}

function selectedStatus() {
  return document.querySelector("#statusFilter")?.value || "pending";
}

function statusQuery(table) {
  const status = selectedStatus();
  if (status === "all") return `${table}?select=*&order=created_at.desc&limit=50`;
  if (table === "payments" && status === "approved") return `${table}?status=eq.verified&select=*&order=created_at.desc&limit=50`;
  return `${table}?status=eq.${status}&select=*&order=created_at.desc&limit=50`;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${adminState.accessToken}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Supabase request failed.");
  }

  if (options.headers?.Prefer?.includes("return=minimal")) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadMembershipChecks() {
  const records = await supabaseRequest(statusQuery("membership_checks"));
  renderCards("#membershipList", records, renderMembershipCard);
}

async function loadDependantUpdates() {
  const updates = await supabaseRequest(statusQuery("dependant_updates"));
  const withItems = [];

  for (const update of updates) {
    const items = await supabaseRequest(`dependant_update_items?update_id=eq.${update.id}&select=*`);
    withItems.push({ ...update, items });
  }

  renderCards("#dependantList", withItems, renderDependantCard);
}

async function loadPayments() {
  const records = await supabaseRequest(statusQuery("payments"));
  renderCards("#paymentList", records, renderPaymentCard);
}

function renderCards(selector, records, renderer) {
  const container = document.querySelector(selector);
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `<p class="empty-state">Tiada rekod untuk status ini.</p>`;
    return;
  }

  container.innerHTML = records.map(renderer).join("");
  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handleAdminAction);
  });
}

function renderMembershipCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.check_type)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>Status: ${escapeHtml(record.status)}</p>
      <p>ID/IC: ${escapeHtml(record.member_identifier || "-")}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Pekerjaan: ${escapeHtml(record.occupation || "-")}</p>
      <p>Alamat: ${escapeHtml(record.address || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-membership" data-id="${record.id}" type="button">Approve</button>` : ""}
        <button class="button button--secondary" data-action="reject-membership" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderDependantCard(record) {
  const items = record.items.map((item) => `
    <li>${escapeHtml(item.item_status)}: ${escapeHtml(item.dependant_name || "-")} (${escapeHtml(item.dependant_ic || "tiada IC")}) - ${escapeHtml(item.gender || "-")}, ${escapeHtml(item.age || "-")} tahun, ${escapeHtml(item.relationship || "-")}</li>
  `).join("");

  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.update_action)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>Status: ${escapeHtml(record.status)}</p>
      <p>No. Ahli/IC: ${escapeHtml(record.member_identifier)}</p>
      <p>Jumlah selepas kemaskini: ${escapeHtml(String(record.dependant_total || "-"))}</p>
      <ul>${items || "<li>Tiada item tanggungan.</li>"}</ul>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-dependant" data-id="${record.id}" type="button">Approve</button>` : ""}
        <button class="button button--secondary" data-action="reject-dependant" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderPaymentCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.payment_method)}</span>
      <h4>${escapeHtml(record.payer_name)}</h4>
      <p>Status: ${escapeHtml(record.status)}</p>
      <p>Jumlah: RM${escapeHtml(String(record.amount || "0"))}</p>
      <p>Catatan: ${escapeHtml(record.note || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-payment" data-id="${record.id}" type="button">Verify</button>` : ""}
        <button class="button button--secondary" data-action="reject-payment" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

async function handleAdminAction(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Processing...";

  try {
    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "approve-membership") await approveMembership(id);
    if (action === "reject-membership") await updateStatus("membership_checks", id, "rejected");
    if (action === "approve-dependant") await approveDependant(id);
    if (action === "reject-dependant") await updateStatus("dependant_updates", id, "rejected");
    if (action === "approve-payment") await approvePayment(id);
    if (action === "reject-payment") await updateStatus("payments", id, "rejected");

    await loadAdminData();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
}

async function approveMembership(id) {
  const [record] = await supabaseRequest(`membership_checks?id=eq.${id}&select=*`);

  if (record.check_type === "daftar") {
    await supabaseRequest("members", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        member_no: record.member_identifier || null,
        member_name: record.member_name,
        ic_no: record.member_identifier || null,
        phone: record.phone || null,
        occupation: record.occupation || null,
        address: record.address || null,
        source_sheet: "WEBSITE",
        source_submission_id: record.id
      })
    });
  }

  await updateStatus("membership_checks", id, "approved");
}

async function approveDependant(id) {
  const [update] = await supabaseRequest(`dependant_updates?id=eq.${id}&select=*`);
  const items = await supabaseRequest(`dependant_update_items?update_id=eq.${id}&select=*`);

  for (const item of items) {
    if (item.item_status === "Tambah" || item.item_status === "Kekal") {
      await supabaseRequest("member_dependants", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          member_no: update.member_identifier,
          member_name: update.member_name,
          dependant_name: item.dependant_name,
          dependant_ic: item.dependant_ic,
          gender: item.gender,
          age: item.age,
          relationship: item.relationship,
          source_sheet: "WEBSITE",
          source_submission_id: update.id
        })
      });
    }

    if (item.item_status === "Buang") {
      await deleteDependant(update, item);
    }
  }

  if (update.dependant_total !== null) {
    await supabaseRequest(`members?member_no=eq.${encodeURIComponent(update.member_identifier)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ dependant_count: update.dependant_total })
    });
  }

  await updateStatus("dependant_updates", id, "approved");
}

async function deleteDependant(update, item) {
  let path = "member_dependants?";
  if (item.dependant_ic) {
    path += `dependant_ic=eq.${encodeURIComponent(item.dependant_ic)}`;
  } else {
    path += `member_name=eq.${encodeURIComponent(update.member_name)}&dependant_name=eq.${encodeURIComponent(item.dependant_name || "")}`;
  }

  await supabaseRequest(path, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}

async function approvePayment(id) {
  const [record] = await supabaseRequest(`payments?id=eq.${id}&select=*`);

  await supabaseRequest("member_yearly_payments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_name: record.payer_name,
      payment_year: new Date().getFullYear(),
      amount: record.amount,
      receipt_no: record.note,
      source_sheet: `WEBSITE-${record.payment_method}`,
      source_submission_id: record.id
    })
  });

  await supabaseRequest(`payments?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "verified" })
  });
}

async function updateStatus(table, id, status) {
  await supabaseRequest(`${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status })
  });
}

function setAdminMessage(selector, text, type = "neutral") {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = text;
  node.className = `form-message form-message--${type}`;
}

function readSupabaseError(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed.msg || parsed.message || parsed.error_description || parsed.error || "";
  } catch {
    return text;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
