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
let locationRecords = [];

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
document.querySelector("#locationSearch")?.addEventListener("input", () => {
  renderLocationTable(filteredLocationRecords());
});
document.querySelector("#logoutAdmin")?.addEventListener("click", () => {
  sessionStorage.removeItem("shkAdminToken");
  sessionStorage.removeItem("shkAdminEmail");
  location.reload();
});
document.querySelector("#adminReceiptButton")?.addEventListener("click", checkAdminReceipt);
document.querySelector("#adminReceiptMemberButton")?.addEventListener("click", searchReceiptMemberByName);
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
    locations: document.querySelector("#adminLocationSection"),
    donations: document.querySelector("#adminDonationSection"),
    transfers: document.querySelector("#adminTransferSection"),
    paid: document.querySelector("#adminPaidSection"),
    receipt: document.querySelector("#adminReceiptSection")
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
    loadSharedLocations(),
    loadDependantUpdates(),
    loadPayments(),
    loadDonations(),
    loadExitRequests(),
    loadPaidOverview(),
    loadLastReceiptNo()
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
  locationRecords = [];
  renderLocationTable([]);
  renderCards("#donationList", [], renderDonationCard);
  renderCards("#exitList", [], renderExitCard);
  renderPaidTable([]);
  setText("#lastReceiptNo", "Belum ada");
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

async function loadSharedLocations() {
  const records = await supabaseRequest("membership_checks?status=eq.approved&location_url=not.is.null&select=member_name,phone,address,location_url,created_at&order=created_at.desc&limit=100");
  locationRecords = records;
  renderLocationTable(filteredLocationRecords());
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

async function loadLastReceiptNo() {
  const receipts = await receiptSources();
  const lastNo = highestReceiptNo(receipts);
  setText("#lastReceiptNo", lastNo ? formatReceiptNo(lastNo) : "Belum ada");
}

async function nextReceiptNo() {
  const receipts = await receiptSources();
  return formatReceiptNo(highestReceiptNo(receipts) + 1);
}

async function receiptSources() {
  const [payments, yearlyPayments, donations] = await Promise.all([
    supabaseRequest("payments?select=receipt_no&receipt_no=not.is.null&limit=1000"),
    supabaseRequest("member_yearly_payments?select=receipt_no&receipt_no=not.is.null&limit=1000"),
    supabaseRequest("non_member_donations?select=receipt_no&receipt_no=not.is.null&limit=1000")
  ]);
  return [...payments, ...yearlyPayments, ...donations].map((record) => record.receipt_no);
}

function highestReceiptNo(receipts) {
  const year = new Date().getFullYear();
  return receipts.reduce((highest, receipt) => {
    const parsed = parseReceiptNo(receipt);
    if (!parsed || parsed.year !== year) return highest;
    return Math.max(highest, parsed.number);
  }, 0);
}

function formatReceiptNo(number) {
  return `SHK-${String(number || 1).padStart(4, "0")}/${new Date().getFullYear()}`;
}

function parseReceiptNo(receipt) {
  const text = String(receipt || "").trim();
  const full = text.match(/^SHK\s*-\s*(\d{1,4})\/(\d{4})$/i);
  if (full) return { number: Number(full[1]), year: Number(full[2]) };
  if (/^\d{1,4}$/.test(text)) return { number: Number(text), year: new Date().getFullYear() };
  return null;
}

function normalizeReceiptSearch(input) {
  const text = String(input || "").trim();
  const parsed = parseReceiptNo(text);
  if (parsed) return `SHK-${String(parsed.number || 1).padStart(4, "0")}/${parsed.year}`;
  return text;
}

function receiptSearchCandidates(input) {
  const raw = String(input || "").trim();
  const normalized = normalizeReceiptSearch(raw);
  const parsed = parseReceiptNo(raw);
  const candidates = [normalized, raw];

  if (parsed) {
    const number = String(parsed.number || 1).padStart(4, "0");
    candidates.push(`SHK - ${number}/${parsed.year}`, number);
  }

  return [...new Set(candidates.filter(Boolean))];
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

function filteredLocationRecords() {
  const query = normalKey(document.querySelector("#locationSearch")?.value || "");
  if (!query) return locationRecords;
  return locationRecords.filter((record) => normalKey(record.member_name).includes(query));
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
      ${record.location_url ? `
        <p>Lokasi: ${escapeHtml(formatCoordinates(record.location_latitude, record.location_longitude))}</p>
        <p><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka lokasi pemohon</a></p>
      ` : ""}
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-membership" data-id="${record.id}" type="button">Approve</button>` : ""}
        <button class="button button--secondary" data-action="reject-membership" data-id="${record.id}" type="button">Reject</button>
      </div>
    </article>
  `;
}

function renderLocationTable(records) {
  const container = document.querySelector("#locationList");
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `<p class="empty-state">Belum ada ahli approved yang share lokasi.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table admin-table--locations">
      <thead>
        <tr>
          <th>Nama Ahli</th>
          <th>No. Telefon</th>
          <th>Alamat</th>
          <th>Lokasi</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            <td>${escapeHtml(record.member_name || "-")}</td>
            <td>${escapeHtml(record.phone || "-")}</td>
            <td>${escapeHtml(record.address || "-")}</td>
            <td><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka Maps</a></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function formatCoordinates(latitude, longitude) {
  if (!latitude || !longitude) return "-";
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
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
      <p>Rujukan Ahli: ${escapeHtml(record.member_identifier)}</p>
      <p>No. Telefon / IC: ${escapeHtml(record.phone || record.member_identifier || "-")}</p>
      ${record.new_name ? `<p>Nama Baru: ${escapeHtml(record.new_name)}</p>` : ""}
      ${record.new_phone ? `<p>No. Telefon Baru: ${escapeHtml(record.new_phone)}</p>` : ""}
      ${record.new_ic ? `<p>IC Baru: ${escapeHtml(record.new_ic)}</p>` : ""}
      ${record.new_address ? `<p>Alamat / Lokasi Baru: ${escapeHtml(record.new_address)}</p>` : ""}
      ${record.location_url ? `<p><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka lokasi baru</a></p>` : ""}
      ${record.dependant_total !== null ? `<p>Jumlah selepas kemaskini: ${escapeHtml(String(record.dependant_total))}</p>` : ""}
      ${items ? `<ul>${items}</ul>` : ""}
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
      <p>No. Telefon: ${escapeHtml(record.payer_identifier || "-")}</p>
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
    if (action === "approve-donation") await approveDonation(id);
    if (action === "reject-donation") await updateStatus("non_member_donations", id, "rejected");
    if (action === "approve-exit") await approveExit(id);
    if (action === "reject-exit") await updateStatus("kariah_exit_requests", id, "rejected");
    if (selectedStatus() === "pending" && card) {
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
    if (item.item_status === "Tambah") {
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

    if (item.item_status === "Kemaskini") {
      await updateDependant(update, item);
    }
  }

  if (update.dependant_total !== null) {
    await supabaseRequest(memberMatchPath(update.member_identifier, update.member_name), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ dependant_count: update.dependant_total })
    });
  }

  const memberPatch = {};
  if (update.new_name) memberPatch.member_name = update.new_name;
  if (update.new_phone) memberPatch.phone = update.new_phone;
  if (update.new_ic) memberPatch.ic_no = update.new_ic;
  if (update.new_address) memberPatch.address = update.new_address;

  if (Object.keys(memberPatch).length) {
    await supabaseRequest(memberMatchPath(update.member_identifier, update.member_name), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(memberPatch)
    });
  }

  await updateStatus("dependant_updates", id, "approved");
}

function memberMatchPath(identifier, memberName = "") {
  const value = encodeURIComponent(identifier || "");
  const name = encodeURIComponent(memberName || "");
  if (!value && !name) return "members?member_no=eq.__missing__";
  if (!value) return `members?member_name=eq.${name}`;
  if (!name || identifier === memberName) return `members?or=(member_no.eq.${value},ic_no.eq.${value},phone.eq.${value},member_name.eq.${value})`;
  return `members?or=(member_no.eq.${value},ic_no.eq.${value},phone.eq.${value},member_name.eq.${name})`;
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
async function updateDependant(update, item) {
  if (!item.dependant_ic && !item.dependant_name) return;

  let path = "member_dependants?";
  if (item.dependant_ic) {
    path += `dependant_ic=eq.${encodeURIComponent(item.dependant_ic)}`;
  } else {
    path += `member_name=eq.${encodeURIComponent(update.member_name)}&dependant_name=eq.${encodeURIComponent(item.dependant_name || "")}`;
  }

  await supabaseRequest(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      dependant_name: item.dependant_name || null,
      dependant_ic: item.dependant_ic || null,
      gender: item.gender || null,
      age: item.age || null,
      relationship: item.relationship || null
    })
  });
}

async function approvePayment(id) {
  const [record] = await supabaseRequest(`payments?id=eq.${id}&select=*`);
  const bankStatementRef = prompt("Masukkan rujukan bank statement / catatan tally:", record.bank_statement_ref || record.receipt_no || "") || record.bank_statement_ref || null;
  const officialReceiptNo = parseReceiptNo(record.receipt_no)
    ? normalizeReceiptSearch(record.receipt_no)
    : await nextReceiptNo();
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
      receipt_no: officialReceiptNo,
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
        receipt_no: officialReceiptNo,
        source_sheet: `WEBSITE-${record.payment_method}-EXCESS`,
        source_submission_id: record.id
      })
    });
  }

  await supabaseRequest(`payments?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "verified", receipt_no: officialReceiptNo, bank_statement_ref: bankStatementRef })
  });
  alert(`Resit digital dijana: ${officialReceiptNo}`);
  await loadLastReceiptNo();
}

async function approveDonation(id) {
  const [record] = await supabaseRequest(`non_member_donations?id=eq.${id}&select=*`);
  const officialReceiptNo = parseReceiptNo(record.receipt_no)
    ? normalizeReceiptSearch(record.receipt_no)
    : await nextReceiptNo();

  await supabaseRequest(`non_member_donations?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "verified", receipt_no: officialReceiptNo })
  });

  alert(`Resit digital dijana: ${officialReceiptNo}`);
  await loadLastReceiptNo();
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
  const receiptInput = document.querySelector("#adminReceiptSearch")?.value.trim();
  const candidates = receiptSearchCandidates(receiptInput);
  if (!answer || !candidates.length) return;

  try {
    let result = null;

    for (const candidate of candidates) {
      const [candidateResult] = await supabaseRpc("check_receipt_status", { receipt_search: candidate });
      result = candidateResult;
      if (candidateResult?.found) break;
    }

    answer.hidden = false;
    answer.innerHTML = renderOfficialReceipt(result);
  } catch (error) {
    answer.hidden = false;
    answer.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function searchReceiptMemberByName() {
  const answer = document.querySelector("#adminReceiptMemberAnswer");
  const query = document.querySelector("#adminReceiptMemberSearch")?.value.trim();
  if (!answer || !query) return;

  try {
    const encoded = encodeURIComponent(`*${query}*`);
    const [payments, yearlyPayments, donations] = await Promise.all([
      supabaseRequest(`payments?payer_name=ilike.${encoded}&select=payer_name,payment_year,amount,receipt_no,status,created_at&order=created_at.desc&limit=20`),
      supabaseRequest(`member_yearly_payments?member_name=ilike.${encoded}&select=member_name,payment_year,amount,receipt_no,imported_at&order=imported_at.desc&limit=20`),
      supabaseRequest(`non_member_donations?donor_name=ilike.${encoded}&select=donor_name,amount,receipt_no,status,created_at&order=created_at.desc&limit=20`)
    ]);

    const records = [
      ...payments.map((record) => ({
        name: record.payer_name,
        receipt_no: record.receipt_no,
        year: record.payment_year,
        amount: record.amount,
        status: record.status,
        created_at: record.created_at
      })),
      ...yearlyPayments.map((record) => ({
        name: record.member_name,
        receipt_no: record.receipt_no,
        year: record.payment_year,
        amount: record.amount,
        status: "verified",
        created_at: record.imported_at
      })),
      ...donations.map((record) => ({
        name: record.donor_name,
        receipt_no: record.receipt_no,
        year: null,
        amount: record.amount,
        status: record.status,
        created_at: record.created_at
      }))
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    answer.hidden = false;

    if (!records.length) {
      answer.innerHTML = `<p>Tiada resit dijumpai untuk nama ini.</p>`;
      return;
    }

    answer.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Nama Ahli</th>
            <th>No. Resit</th>
            <th>Tahun</th>
            <th>Jumlah</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record) => `
            <tr>
              <td>${escapeHtml(record.name || "-")}</td>
              <td>${escapeHtml(record.receipt_no ? normalizeReceiptSearch(record.receipt_no) : "Belum dijana")}</td>
              <td>${escapeHtml(record.year || "-")}</td>
              <td>RM${escapeHtml(String(record.amount || "0"))}</td>
              <td>${escapeHtml(record.status || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    answer.hidden = false;
    answer.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}
function renderOfficialReceipt(result) {
  if (!result.found) {
    return `
      <span class="status-pill">${escapeHtml(result.status)}</span>
      <p>Semak nombor resit dan cuba semula.</p>
    `;
  }

  return `
    <article class="official-receipt" id="officialReceipt">
      <div class="receipt-head">
        <div>
          <span>Resit Rasmi</span>
          <h3>Surau Haji Kamaruddin</h3>
          <p>Batu 7 1/2 Jalan Meru Tambahan, Meru</p>
        </div>
        <strong>${escapeHtml(normalizeReceiptSearch(result.receipt_no) || "-")}</strong>
      </div>
      <div class="receipt-meta">
        <p><span>Status</span><strong>${escapeHtml(result.status || "-")}</strong></p>
        <p><span>Tarikh</span><strong>${escapeHtml(formatReceiptDate(result.created_at))}</strong></p>
      </div>
      <dl class="receipt-lines">
        <div><dt>Nama Pembayar</dt><dd>${escapeHtml(result.payer_name || "-")}</dd></div>
        <div><dt>Kaedah Bayaran</dt><dd>${escapeHtml(result.payment_method || "-")}</dd></div>
        <div><dt>Tahun Bayaran</dt><dd>${escapeHtml(result.payment_year || "-")}</dd></div>
        <div><dt>Jumlah</dt><dd>RM${escapeHtml(String(result.amount || "0"))}</dd></div>
      </dl>
      <p class="receipt-note">Resit ini dijana oleh sistem Khairat Surau Haji Kamaruddin selepas bayaran disahkan oleh admin.</p>
    </article>
    <button class="button button--primary receipt-print-button" type="button" onclick="window.print()">Print Resit</button>
  `;
}

function formatReceiptDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

async function moveMemberToInactive() {
  const memberName = document.querySelector("#adminExitName")?.value.trim();
  const icNo = document.querySelector("#adminExitIc")?.value.trim();

  if (!memberName || !icNo) {
    alert("Masukkan nama ahli dan no. IC.");
    return;
  }

  try {
    requireIcDashFormat(icNo, "No. IC");
  } catch (error) {
    alert(error.message);
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

function isIcDashFormat(value) {
  return /^\d{6}-\d{2}-\d{4}$/.test(String(value || "").trim());
}

function requireIcDashFormat(value, label) {
  const text = String(value || "").trim();
  if (text && !isIcDashFormat(text)) {
    throw new Error(`${label} mesti format XXXXXX-XX-XXXX, contoh 710513-10-6035.`);
  }
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
