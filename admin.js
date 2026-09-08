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
const adminToggle = document.querySelector("#adminNavToggle");
const adminMenu = document.querySelector("#admin-menu");
let paidOverviewRecords = [];

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
document.querySelector("#paidSearch")?.addEventListener("input", () => {
  renderPaidTable(filteredPaidRecords());
});
document.querySelector("#logoutAdmin")?.addEventListener("click", () => {
  sessionStorage.removeItem("shkAdminToken");
  sessionStorage.removeItem("shkAdminEmail");
  location.reload();
});
document.querySelector("#adminReceiptButton")?.addEventListener("click", checkAdminReceipt);
document.querySelector("#queueReminder")?.addEventListener("click", () => {
  queueEmailReminder().catch((error) => setAdminMessage("#reminderMessage", error.message, "error"));
});
document.querySelector("#sendReminders")?.addEventListener("click", () => {
  sendQueuedReminders().catch((error) => setAdminMessage("#reminderMessage", error.message, "error"));
});
document.querySelector("#runBackup")?.addEventListener("click", () => {
  runDatabaseBackup().catch((error) => setAdminMessage("#backupMessage", error.message, "error"));
});
document.querySelector("#adminExitButton")?.addEventListener("click", moveMemberToInactive);
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => showAdminView(button.dataset.adminView));
});

if (adminToggle && adminMenu) {
  adminToggle.addEventListener("click", () => {
    const open = adminMenu.classList.toggle("is-open");
    adminToggle.setAttribute("aria-expanded", String(open));
  });

  adminMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLButtonElement) {
      adminMenu.classList.remove("is-open");
      adminToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function showAdmin() {
  adminPanel.hidden = false;
  if (adminMenu) adminMenu.hidden = false;
  if (adminToggle) adminToggle.hidden = false;
  showAdminView("dashboard");
}

function showAdminView(view) {
  const sections = {
    dashboard: document.querySelector("#adminDashboard"),
    approval: document.querySelector("#adminApprovalSections"),
    donations: document.querySelector("#adminDonationSection"),
    transfers: document.querySelector("#adminTransferSection"),
    paid: document.querySelector("#adminPaidSection"),
    receipt: document.querySelector("#adminReceiptSection"),
    backup: document.querySelector("#adminBackupSection"),
    reminder: document.querySelector("#adminReminderSection")
  };

  Object.entries(sections).forEach(([key, section]) => {
    if (section) section.hidden = key !== view;
  });

  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminView === view);
  });
}

async function loadAdminData() {
  await checkAdminAccess();
  await Promise.all([
    loadMembershipChecks(),
    loadDependantUpdates(),
    loadPayments(),
    loadDonations(),
    loadExitRequests(),
    loadPaidOverview()
  ]);
  await updateAdminSummary(paidOverviewRecords);
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
  renderCards("#donationList", [], renderDonationCard);
  renderCards("#exitList", [], renderExitCard);
  renderPaidTable([]);
}

function selectedStatus() {
  return document.querySelector("#statusFilter")?.value || "pending";
}

function statusQuery(table) {
  const status = selectedStatus();
  if (status === "all") return `${table}?select=*&order=created_at.desc&limit=50`;
  if (table === "payments" && status === "approved") return `${table}?status=eq.verified&select=*&order=created_at.desc&limit=50`;
  if (table === "non_member_donations" && status === "approved") return `${table}?status=eq.verified&select=*&order=created_at.desc&limit=50`;
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

async function loadDonations() {
  const records = await supabaseRequest("non_member_donations?select=*&order=created_at.desc&limit=100");
  renderCards("#donationList", records, renderDonationCard);
}

async function loadExitRequests() {
  const records = await supabaseRequest("kariah_exit_requests?select=*&order=created_at.desc&limit=100");
  renderCards("#exitList", records, renderExitCard);
}

async function loadPaidOverview() {
  const year = new Date().getFullYear();
  const members = await supabaseRequest("members?select=member_no,member_name,phone,email&membership_status=eq.aktif&order=member_name.asc&limit=1000");
  const payments = await supabaseRequest(`member_yearly_payments?payment_year=eq.${year}&select=member_no,member_name,amount&limit=1000`);
  const paidKeys = new Set(payments.map((payment) => normalKey(payment.member_no || payment.member_name)));
  paidOverviewRecords = members.map((member) => ({
    ...member,
    payment_year: year,
    paid: paidKeys.has(normalKey(member.member_no || member.member_name))
  }));
  renderPaidTable(filteredPaidRecords());
}

function filteredPaidRecords() {
  const query = normalKey(document.querySelector("#paidSearch")?.value || "");
  if (!query) return paidOverviewRecords;
  return paidOverviewRecords.filter((record) => {
    return normalKey(record.member_name).includes(query)
      || normalKey(record.member_no).includes(query)
      || normalKey(record.email).includes(query);
  });
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

async function updateAdminSummary(paidRecords = []) {
  const pendingCounts = await Promise.all([
    countPending("membership_checks"),
    countPending("dependant_updates"),
    countPending("payments")
  ]);
  const pendingCount = pendingCounts.reduce((total, count) => total + count, 0);
  const paidCount = paidRecords.filter((record) => record.paid).length;
  const notPaidCount = paidRecords.length - paidCount;

  setText("#pendingCount", String(pendingCount));
  setText("#paidCount", String(paidCount));
  setText("#notPaidCount", String(notPaidCount));
}

async function countPending(table) {
  const records = await supabaseRequest(`${table}?status=eq.pending&select=id&limit=1000`);
  return records.length;
}

function renderMembershipCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.check_type)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>Status: ${escapeHtml(record.status)}</p>
      <p>ID/IC: ${escapeHtml(record.member_identifier || "-")}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Email: ${escapeHtml(record.email || "-")}</p>
      <p>Pekerjaan: ${escapeHtml(record.occupation || "-")}</p>
      <p>Alamat: ${escapeHtml(record.address || "-")}</p>
      ${record.location_url ? `<p><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka lokasi pemohon</a></p>` : ""}
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
      <p>ID/IC/Tel: ${escapeHtml(record.payer_identifier || "-")}</p>
      <p>Tahun: ${escapeHtml(record.payment_year || "-")}</p>
      <p>Jumlah: RM${escapeHtml(String(record.amount || "0"))}</p>
      <p>No. Resit: ${escapeHtml(record.receipt_no || "-")}</p>
      ${record.receipt_proof_url ? `<p><a href="${escapeHtml(record.receipt_proof_url)}" target="_blank" rel="noopener">Buka bukti bayaran</a></p>` : ""}
      ${record.receipt_proof_data ? `<p><a href="${escapeHtml(record.receipt_proof_data)}" download="${escapeHtml(record.receipt_proof_name || "resit-bayaran.png")}">Download gambar resit</a></p>` : ""}
      <p>Catatan: ${escapeHtml(record.note || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-payment" data-id="${record.id}" type="button">Verify</button>` : ""}
        <button class="button button--secondary" data-action="reject-payment" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderDonationCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.payment_method)}</span>
      <h4>${escapeHtml(record.donor_name)}</h4>
      <p>Status: ${escapeHtml(record.status)}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Jumlah: RM${escapeHtml(String(record.amount || "0"))}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-donation" data-id="${record.id}" type="button">Verify</button>` : ""}
        <button class="button button--secondary" data-action="reject-donation" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderExitCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.status)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>ID/IC/Tel: ${escapeHtml(record.member_identifier || "-")}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Alamat baru: ${escapeHtml(record.new_address || "-")}</p>
      <p>Sebab: ${escapeHtml(record.reason || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-exit" data-id="${record.id}" type="button">Approve</button>` : ""}
        <button class="button button--secondary" data-action="reject-exit" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderPaidTable(records) {
  const container = document.querySelector("#paidList");
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `<p class="empty-state">Tiada rekod ahli aktif.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nama Ahli</th>
          <th>No. Ahli</th>
          <th>Tahun</th>
          <th>Status</th>
          <th>Email</th>
          <th>Tindakan</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            <td>${escapeHtml(record.member_name || "-")}</td>
            <td>${escapeHtml(record.member_no || "-")}</td>
            <td>${escapeHtml(String(record.payment_year))}</td>
            <td><span class="status-pill ${record.paid ? "status-pill--success" : ""}">${record.paid ? "Paid" : "Not paid"}</span></td>
            <td>${escapeHtml(record.email || "-")}</td>
            <td>${!record.paid && record.email ? `<button class="button button--secondary button--small" data-action="queue-user-reminder" data-email="${escapeHtml(record.email)}" data-name="${escapeHtml(record.member_name || "")}" type="button">Reminder</button>` : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handleAdminAction);
  });
}

async function handleAdminAction(event) {
  const button = event.currentTarget;
  const card = button.closest(".admin-card");
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
    if (action === "approve-donation") await updateStatus("non_member_donations", id, "verified");
    if (action === "reject-donation") await updateStatus("non_member_donations", id, "rejected");
    if (action === "approve-exit") await approveExit(id);
    if (action === "reject-exit") await updateStatus("kariah_exit_requests", id, "rejected");
    if (action === "queue-user-reminder") await queueReminderForMember(button.dataset.email, button.dataset.name);

    if (selectedStatus() === "pending" && card && action !== "queue-user-reminder") {
      card.remove();
    }
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
        email: record.email || null,
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
  const bankStatementRef = prompt("Masukkan rujukan bank statement / catatan tally:", record.bank_statement_ref || record.receipt_no || "") || record.bank_statement_ref || null;
  const year = record.payment_year || new Date().getFullYear();
  const amount = Number(record.amount || 0);
  const annualAmount = 50;
  const currentYearAmount = record.apply_excess_to_next_year && amount > annualAmount ? annualAmount : amount;
  const excessAmount = record.apply_excess_to_next_year && amount > annualAmount ? amount - annualAmount : 0;

  await supabaseRequest("member_yearly_payments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_no: record.payer_identifier || null,
      member_name: record.payer_name,
      payment_year: year,
      amount: currentYearAmount,
      receipt_no: record.receipt_no || record.note,
      source_sheet: `WEBSITE-${record.payment_method}`,
      source_submission_id: record.id
    })
  });

  if (excessAmount > 0) {
    await supabaseRequest("member_yearly_payments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        member_no: record.payer_identifier || null,
        member_name: record.payer_name,
        payment_year: year + 1,
        amount: excessAmount,
        receipt_no: record.receipt_no || record.note,
        source_sheet: `WEBSITE-${record.payment_method}-EXCESS`,
        source_submission_id: record.id
      })
    });
  }

  await supabaseRequest(`payments?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "verified", bank_statement_ref: bankStatementRef })
  });
}

async function approveExit(id) {
  const [record] = await supabaseRequest(`kariah_exit_requests?id=eq.${id}&select=*`);
  const identifier = encodeURIComponent(record.member_identifier || "");

  if (record.member_identifier) {
    await supabaseRequest(`members?or=(member_no.eq.${identifier},ic_no.eq.${identifier})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        membership_status: "keluar_kariah",
        left_kariah_note: record.reason || record.new_address || "Pindahan Ahli"
      })
    });
  }

  await supabaseRequest("inactive_members", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_no: record.member_identifier || null,
      member_name: record.member_name,
      phone: record.phone || null,
      address: record.new_address || null,
      details: record.reason || "Pindahan Ahli",
      source_sheet: "WEBSITE"
    })
  });

  await updateStatus("kariah_exit_requests", id, "approved");
}

async function updateStatus(table, id, status) {
  await supabaseRequest(`${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status })
  });
}

async function checkAdminReceipt() {
  const answer = document.querySelector("#adminReceiptAnswer");
  const receipt = document.querySelector("#adminReceiptSearch")?.value.trim();
  if (!answer || !receipt) return;

  try {
    const [result] = await supabaseRpc("check_receipt_status", { receipt_search: receipt });
    answer.hidden = false;
    answer.innerHTML = `
      <span class="status-pill ${result.found ? "status-pill--success" : ""}">${escapeHtml(result.status)}</span>
      ${result.payer_name ? `<h3>${escapeHtml(result.payer_name)}</h3>` : ""}
      ${result.receipt_no ? `<p>No. resit: ${escapeHtml(result.receipt_no)}</p>` : ""}
      ${result.payment_year ? `<p>Tahun: ${escapeHtml(result.payment_year)}</p>` : ""}
      ${result.amount ? `<p>Jumlah: RM${escapeHtml(result.amount)}</p>` : ""}
    `;
  } catch (error) {
    answer.hidden = false;
    answer.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function queueEmailReminder() {
  const recipientEmail = document.querySelector("#reminderEmail")?.value.trim();
  if (!recipientEmail) {
    setAdminMessage("#reminderMessage", "Masukkan email penerima.", "error");
    return;
  }

  setAdminMessage("#reminderMessage", "Sedang simpan reminder...", "neutral");
  await supabaseRequest("reminder_queue", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      reminder_type: "user_unpaid",
      recipient_email: recipientEmail,
      subject: document.querySelector("#reminderSubject")?.value.trim() || "Peringatan Bayaran Khairat",
      message: "Sila semak dan jelaskan bayaran khairat jika masih belum selesai."
    })
  });

  setAdminMessage("#reminderMessage", "Reminder dimasukkan ke queue.", "success");
}

async function queueReminderForMember(email, name) {
  await supabaseRequest("reminder_queue", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      reminder_type: "user_unpaid",
      recipient_email: email,
      recipient_name: name || null,
      subject: "Peringatan Bayaran Khairat",
      message: "Rekod menunjukkan bayaran khairat tahun ini belum selesai. Sila semak dan jelaskan bayaran jika masih belum dibuat."
    })
  });
}

async function sendQueuedReminders() {
  setAdminMessage("#reminderMessage", "Sedang hantar email reminder...", "neutral");
  const result = await callEdgeFunction("send-reminders");
  setAdminMessage("#reminderMessage", `Email diproses: ${result.sent || 0} berjaya, ${result.failed || 0} gagal.`, "success");
}

async function runDatabaseBackup() {
  setAdminMessage("#backupMessage", "Sedang buat backup database...", "neutral");
  const result = await callEdgeFunction("database-backup");
  const tableWarnings = result.table_errors && Object.keys(result.table_errors).length
    ? ` Ada warning table: ${Object.keys(result.table_errors).join(", ")}.`
    : "";
  const warning = result.warning ? ` ${result.warning}` : "";
  setAdminMessage("#backupMessage", `Backup disimpan: ${result.backup_name || result.path || "selesai"}.${tableWarnings}${warning}`, "success");
}

async function callEdgeFunction(functionName) {
  const response = await fetch(`${config.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${adminState.accessToken}`
    },
    body: JSON.stringify({})
  });

  const text = await response.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { error: text };
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`${functionName} belum deploy di Supabase Edge Functions.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${functionName} tiada permission. Pastikan awak login admin dan email ada dalam admin_users.`);
    }
    throw new Error(result.error || text || `${functionName} gagal.`);
  }
  return result;
}

async function moveMemberToInactive() {
  const memberName = document.querySelector("#adminExitName")?.value.trim();
  const icNo = document.querySelector("#adminExitIc")?.value.trim();

  if (!memberName || !icNo) {
    alert("Masukkan nama ahli dan no. IC.");
    return;
  }

  const encodedIc = encodeURIComponent(icNo);
  await supabaseRequest(`members?or=(ic_no.eq.${encodedIc},member_no.eq.${encodedIc})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      membership_status: "keluar_kariah",
      left_kariah_note: "Dipindahkan oleh admin"
    })
  });

  await supabaseRequest("inactive_members", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_name: memberName,
      member_no: icNo,
      details: "Keluar kariah / dipindahkan oleh admin",
      source_sheet: "WEBSITE"
    })
  });

  await supabaseRequest("kariah_exit_requests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_name: memberName,
      member_identifier: icNo,
      reason: "Dipindahkan oleh admin",
      status: "approved"
    })
  });

  document.querySelector("#adminExitName").value = "";
  document.querySelector("#adminExitIc").value = "";
  alert("Ahli berjaya dipindahkan.");
  await loadAdminData();
}

function normalKey(value) {
  return String(value || "").trim().toLowerCase();
}

function setAdminMessage(selector, text, type = "neutral") {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = text;
  node.className = `form-message form-message--${type}`;
}

function setText(selector, text) {
  const node = document.querySelector(selector);
  if (node) node.textContent = text;
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
