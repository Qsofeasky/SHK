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
let paidYearSummary = {
  year: new Date().getFullYear(),
  totalAmount: 0,
  paidCount: 0,
  unpaidCount: 0
};
let paidAllYearTotals = [];
let paidFeeView = "annual";
let locationRecords = [];

const paidYearFilter = document.querySelector("#paidYearFilter");
if (paidYearFilter) {
  const currentYear = String(new Date().getFullYear());
  if ([...paidYearFilter.options].some((option) => option.value === currentYear)) {
    paidYearFilter.value = currentYear;
  }
}

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
      throw new Error(readSupabaseError(errorText) || "Log masuk gagal. Semak email/kata laluan Supabase Auth.");
    }

    const session = await response.json();
    adminState.accessToken = session.access_token;
    adminState.userEmail = session.user?.email || "";
    sessionStorage.setItem("shkAdminToken", adminState.accessToken);
    sessionStorage.setItem("shkAdminEmail", adminState.userEmail);
    showAdmin();
    await loadAdminData();
    setAdminMessage("#loginMessage", "Log masuk berjaya.", "success");
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
document.querySelector("#paidViewFilter")?.addEventListener("change", (event) => setPaidFeeView(event.target.value));
paidYearFilter?.addEventListener("change", () => {
  loadPaidOverview()
    .then(() => updateAdminSummary(paidOverviewRecords))
    .catch(showAdminError);
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
attachAutoFormatters();

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
    throw new Error(`Log masuk berjaya sebagai ${email}, tetapi email ini belum ada dalam table admin_users.`);
  }

  setAdminMessage("#adminStatus", `Log masuk admin aktif: ${email}`, "success");
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

async function callEdgeFunction(functionName, payload = {}) {
  const response = await fetch(`${config.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${adminState.accessToken}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || text || "Edge Function gagal.");
  }

  return data;
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
  paidYearSummary = {
    year: Number(paidYearFilter?.value) || new Date().getFullYear(),
    totalAmount: 0,
    paidCount: 0,
    unpaidCount: 0
  };
  paidAllYearTotals = [];
  renderPaidSummary();
  renderAllYearTotals();
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
  const year = Number(paidYearFilter?.value) || new Date().getFullYear();
  const data = await supabaseRpc("admin_fee_overview", { p_year: year });
  paidOverviewRecords = (data.members || []).map(member => ({...member,payment_year:year,paid:member.annual_status === "paid",amount:Number(member.annual_paid || 0)}));
  paidYearSummary = {year,totalAmount:Number(data.annual_total || 0),registrationTotal:Number(data.registration_total || 0),
    paidCount:paidOverviewRecords.filter(m=>Number(m.annual_paid || 0)>0).length,
    partialCount:paidOverviewRecords.filter(m=>m.annual_status === "partial").length,
    unpaidCount:paidOverviewRecords.filter(m=>Number(m.annual_paid || 0)<=0).length,
    needsIcCount:paidOverviewRecords.filter(m=>m.annual_status === "needs_ic").length};
  paidAllYearTotals = data.year_totals || [];
  for (const total of paidAllYearTotals) {
    if (paidYearFilter && ![...paidYearFilter.options].some(o=>Number(o.value) === total.payment_year)) {
      const option=document.createElement("option");option.value=total.payment_year;option.textContent=total.payment_year;paidYearFilter.appendChild(option);
    }
  }
  renderPaidSummary();renderAllYearTotals();renderPaidTable(filteredPaidRecords());
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

function paymentAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value) {
  return `RM${paymentAmount(value).toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function summarizePaymentsByYear(payments) {
  const totals = payments.reduce((map, payment) => {
    const year = Number(payment.payment_year) || 0;
    if (!year) return map;
    const current = map.get(year) || { year, totalAmount: 0, recordCount: 0 };
    current.totalAmount += paymentAmount(payment.amount);
    current.recordCount += 1;
    map.set(year, current);
    return map;
  }, new Map());

  return [...totals.values()].sort((a, b) => b.year - a.year);
}

function setPaidFeeView(view) {
  paidFeeView = ["annual", "registration", "allocation"].includes(view) ? view : "annual";
  const titles = {annual: "Bayaran Ahli", registration: "Yuran Pendaftaran", allocation: "Agihan Yuran Mengikut Tahun"};
  document.querySelector("#paidViewTitle").textContent = titles[paidFeeView];
  document.querySelector("#paidViewFilter").value = paidFeeView;
  document.querySelector("#paidList").hidden = paidFeeView !== "annual";
  document.querySelector("#paidRegistrationList").hidden = paidFeeView !== "registration";
  document.querySelector("#paidAllYearTotals").hidden = paidFeeView !== "allocation";
  for (const id of ["paidYearSummary", "paidYearField", "paidSearchField"]) {
    document.getElementById(id).hidden = paidFeeView === "allocation";
  }
  renderPaidSummary();
}

function renderPaidSummary() {
  const box=document.querySelector("#paidYearSummary");if(!box)return;
  box.innerHTML=`<article data-fee-summary="registration" class="price-card"><span>Yuran Pendaftaran ${escapeHtml(String(paidYearSummary.year))}</span><strong>${escapeHtml(formatMoney(paidYearSummary.registrationTotal))}</strong><small>Jumlah pendaftaran diperuntukkan pada tahun dipilih, termasuk rekod import yang mempunyai tahun pendaftaran.</small></article>
  <article data-fee-summary="annual" class="price-card"><span>Yuran Ahli ${escapeHtml(String(paidYearSummary.year))}</span><strong>${escapeHtml(formatMoney(paidYearSummary.totalAmount))}</strong><small>Jumlah diperuntukkan untuk tahun dipilih. Lebihan untuk tahun hadapan ditunjukkan pada tahun berkenaan.</small></article>
  <article data-fee-summary="annual" class="price-card"><span>Status Yuran Ahli</span><strong>${paidYearSummary.paidCount} sudah bayar</strong><small>${paidYearSummary.unpaidCount} belum bayar. Status berdasarkan kewujudan rekod yuran tahunan.</small></article>`;
  box.querySelectorAll("[data-fee-summary]").forEach(card => { card.hidden = card.dataset.feeSummary !== paidFeeView; });
}

function renderAllYearTotals() {
 const box=document.querySelector("#paidAllYearTotals");if(!box)return;
 box.innerHTML=`<h4>Agihan Yuran Mengikut Tahun</h4><table class="admin-table"><thead><tr><th>Tahun</th><th>Yuran Pendaftaran</th><th>Yuran Ahli</th></tr></thead><tbody>${paidAllYearTotals.map(t=>`<tr><td>${escapeHtml(String(t.payment_year))}</td><td>${escapeHtml(formatMoney(t.registration_total))}</td><td>${escapeHtml(formatMoney(t.annual_total))}</td></tr>`).join("")}</tbody></table>`;
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
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date()));
  const currentRecords = paidYearSummary.year === year ? paidRecords : (await supabaseRpc("admin_fee_overview", { p_year: year })).members || [];
  const paidCount = currentRecords.filter((record) => Number(record.annual_paid || 0) > 0).length;
  const notPaidCount = currentRecords.length - paidCount;
  setText("#paidCountLabel", `Ada Rekod Bayaran ${year}`);
  setText("#notPaidCountLabel", `Tiada Rekod Bayaran ${year}`);

  setText("#pendingCount", String(pendingCount));
  setText("#membershipPendingCount", String(pendingCounts[0]));
  setText("#dependantPendingCount", String(pendingCounts[1]));
  setText("#paymentPendingCount", String(pendingCounts[2]));
  setText("#paidCount", String(paidCount));
  setText("#notPaidCount", String(notPaidCount));
}

async function countPending(table) {
  const records = await supabaseRequest(`${table}?status=eq.pending&select=id&limit=1000`);
  return records.length;
}

function displayStatus(status) {
  const labels = {
    pending: "Menunggu",
    reviewed: "Telah Disemak",
    approved: "Diluluskan",
    verified: "Disahkan",
    rejected: "Ditolak"
  };
  return labels[status] || status || "-";
}

function displayPaymentMethod(method) {
  const labels = {
    online: "Pindahan bank / dalam talian",
    cash: "Tunai kepada AJK"
  };
  return labels[method] || method || "-";
}

function renderMembershipCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.check_type)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>Status: ${escapeHtml(displayStatus(record.status))}</p>
      <p>ID/IC: ${escapeHtml(record.member_identifier || "-")}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Email: ${escapeHtml(record.email || "-")}</p>
      <p>Pekerjaan: ${escapeHtml(record.occupation || "-")}</p>
      <p>Alamat Rumah Sekarang: ${escapeHtml(record.address || "-")}</p>
      <p>Status Alamat Rumah: ${escapeHtml(record.residence_type || "-")}</p>
      ${record.ic_proof_storage_path ? `<p><button class="button button--secondary button--small" data-action="open-ic-proof" data-path="${escapeHtml(record.ic_proof_storage_path)}" type="button">Buka gambar IC</button></p>` : ""}
      ${record.ic_proof_url ? `<p><a href="${escapeHtml(record.ic_proof_url)}" target="_blank" rel="noopener">Buka gambar IC</a></p>` : ""}
      ${!record.ic_proof_url && record.ic_proof_data ? `<p><a href="${escapeHtml(record.ic_proof_data)}" download="${escapeHtml(record.ic_proof_name || "gambar-ic.png")}">Muat turun gambar IC</a></p>` : ""}
      ${record.location_url ? `
        <p>Lokasi Kediaman Sekarang: ${escapeHtml(formatLocationSource(record.location_latitude, record.location_longitude))}</p>
        <p><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka lokasi pemohon</a></p>
      ` : ""}
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-membership" data-id="${record.id}" type="button">Luluskan</button>` : ""}
        <button class="button button--secondary" data-action="reject-membership" data-id="${record.id}" type="button">Tolak</button>
      </div>
    </article>
  `;
}

function renderLocationTable(records) {
  const container = document.querySelector("#locationList");
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `<p class="empty-state">Belum ada ahli diluluskan yang kongsi lokasi.</p>`;
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

function formatLocationSource(latitude, longitude) {
  return latitude && longitude ? formatCoordinates(latitude, longitude) : "Berdasarkan alamat rumah";
}

function renderDependantCard(record) {
  const items = record.items.map((item) => `
    <li>${escapeHtml(item.item_status)}: ${escapeHtml(item.dependant_name || "-")} (${escapeHtml(item.dependant_ic || "tiada IC")}) - ${escapeHtml(item.gender || "-")}, ${escapeHtml(item.age || "-")} tahun, ${escapeHtml(item.relationship || "-")}</li>
  `).join("");

  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(record.update_action)}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>Status: ${escapeHtml(displayStatus(record.status))}</p>
      <p>Rujukan Ahli: ${escapeHtml(record.member_identifier)}</p>
      <p>No. Telefon / IC: ${escapeHtml(record.phone || record.member_identifier || "-")}</p>
      ${record.applied_at ? `<p>Disimpan pada rekod ahli: ${escapeHtml(new Date(record.applied_at).toLocaleString("ms-MY"))}</p>` : record.status === "approved" ? `<p>Kelulusan lama: simpanan perlu disemak.</p>` : ""}
      ${record.new_name ? `<p>Nama Baru: ${escapeHtml(record.new_name)}</p>` : ""}
      ${record.new_phone ? `<p>No. Telefon Baru: ${escapeHtml(record.new_phone)}</p>` : ""}
      ${record.new_ic ? `<p>IC Baru: ${escapeHtml(record.new_ic)}</p>` : ""}
      ${record.new_address ? `<p>Alamat Rumah Sekarang: ${escapeHtml(record.new_address)}</p>` : ""}
      ${record.new_residence_type ? `<p>Status Alamat Rumah: ${escapeHtml(record.new_residence_type)}</p>` : ""}
      ${record.location_url ? `<p><a href="${escapeHtml(record.location_url)}" target="_blank" rel="noopener">Buka lokasi baru</a></p>` : ""}
      ${record.dependant_total !== null ? `<p>Jumlah selepas kemaskini: ${escapeHtml(String(record.dependant_total))}</p>` : ""}
      ${items ? `<ul>${items}</ul>` : ""}
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-dependant" data-id="${record.id}" type="button">Luluskan</button>` : ""}
        <button class="button button--secondary" data-action="reject-dependant" data-id="${record.id}" type="button">Tolak</button>
      </div>
    </article>
  `;
}

function renderPaymentCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(displayPaymentMethod(record.payment_method))}</span>
      <h4>${escapeHtml(record.payer_name)}</h4>
      <p>Status: ${escapeHtml(displayStatus(record.status))}</p>
      <p>No. Telefon: ${escapeHtml(record.payer_identifier || "-")}</p>
      <p>Tahun: ${escapeHtml(record.payment_year || "-")}</p>
      <p>Jumlah: RM${escapeHtml(String(record.amount || "0"))}</p>
      <p>Jenis: ${escapeHtml(({annual:"Yuran Ahli",registration:"Yuran Pendaftaran",mixed:"Pendaftaran + Yuran Ahli"})[record.fee_type] || "Yuran Ahli")}</p>
      ${record.status === "pending" ? `<label>Agihkan sebagai<select data-fee-type><option value="annual" ${record.fee_type === "annual" || !record.fee_type ? "selected" : ""}>Yuran Ahli</option><option value="registration" ${record.fee_type === "registration" ? "selected" : ""}>Yuran Pendaftaran</option><option value="mixed" ${record.fee_type === "mixed" ? "selected" : ""}>Pendaftaran + Yuran Ahli</option></select></label>` : ""}

      <p>Kategori pilihan ahli: ${escapeHtml(record.rate_category === "under60" ? "Bawah 60 tahun" : record.rate_category === "60plus" ? "60 tahun ke atas" : "Belum dipilih")}</p>
      ${record.status === "pending" ? `<label>Kategori kadar untuk pengesahan<select data-rate-category><option value="">Pilih kategori kadar</option><option value="under60" ${record.rate_category === "under60" ? "selected" : ""}>Bawah 60 tahun — Pendaftaran RM50 / Tahunan RM30</option><option value="60plus" ${record.rate_category === "60plus" ? "selected" : ""}>60 tahun ke atas — Pendaftaran RM30 / Tahunan RM20</option></select></label>` : ""}
      <p>No. Resit: ${escapeHtml(record.receipt_no || "-")}</p>
      <p>No. Rujukan Bank: ${escapeHtml(record.bank_statement_ref || "-")}</p>
      ${record.receipt_proof_url ? `<p><a href="${escapeHtml(record.receipt_proof_url)}" target="_blank" rel="noopener">Buka bukti bayaran</a></p>` : ""}
      ${record.receipt_proof_data ? `<p><a href="${escapeHtml(record.receipt_proof_data)}" download="${escapeHtml(record.receipt_proof_name || "resit-bayaran.png")}">Muat turun gambar resit</a></p>` : ""}
      <p>Catatan: ${escapeHtml(record.note || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-payment" data-id="${record.id}" type="button">Sahkan</button>` : ""}
        <button class="button button--secondary" data-action="reject-payment" data-id="${record.id}" type="button">Tolak</button>
      </div>
    </article>
  `;
}

function renderDonationCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(displayPaymentMethod(record.payment_method))}</span>
      <h4>${escapeHtml(record.donor_name)}</h4>
      <p>Status: ${escapeHtml(displayStatus(record.status))}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Jumlah: RM${escapeHtml(String(record.amount || "0"))}</p>
      <p>Catatan: ${escapeHtml(record.note || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-donation" data-id="${record.id}" type="button">Sahkan</button>` : ""}
        <button class="button button--secondary" data-action="reject-donation" data-id="${record.id}" type="button">Tolak</button>
      </div>
    </article>
  `;
}

function renderExitCard(record) {
  return `
    <article class="admin-card">
      <span class="status-pill">${escapeHtml(displayStatus(record.status))}</span>
      <h4>${escapeHtml(record.member_name)}</h4>
      <p>ID/IC/Tel: ${escapeHtml(record.member_identifier || "-")}</p>
      <p>Telefon: ${escapeHtml(record.phone || "-")}</p>
      <p>Alamat baru: ${escapeHtml(record.new_address || "-")}</p>
      <p>Sebab: ${escapeHtml(record.reason || "-")}</p>
      <div class="form-actions">
        ${record.status === "pending" ? `<button class="button button--primary" data-action="approve-exit" data-id="${record.id}" type="button">Luluskan</button>` : ""}
        <button class="button button--secondary" data-action="reject-exit" data-id="${record.id}" type="button">Tolak</button>
      </div>
    </article>
  `;
}

function renderPaidTable(records) {
 const box=document.querySelector("#paidList"), registrationBox=document.querySelector("#paidRegistrationList");if(!box || !registrationBox)return;
 if(!records.length){box.innerHTML=registrationBox.innerHTML='<p class="empty-state">Tiada rekod ahli yang sepadan.</p>';return;}
 const money=value=>value === null || value === undefined ? "—" : escapeHtml(formatMoney(value));
 registrationBox.innerHTML=`<h4>Yuran Pendaftaran — Sekali Sahaja</h4><p>Kadar mengikut kategori pilihan ahli: bawah 60 tahun RM50; 60 tahun ke atas RM30. Kadar pendaftaran lama mengikut jumlah bayaran yang direkodkan. Bayaran baharu mengikut kategori pilihan ahli. Status Sudah Bayar bermaksud ada rekod bayaran.</p>
 <table class="admin-table"><thead><tr><th>Nama Ahli</th><th>Kadar</th><th>Telah Dibayar</th><th>Baki</th><th>Status</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHtml(r.member_name)}</td><td>${money(r.registration_due)}</td><td>${money(r.registration_paid)}</td><td>${money(r.registration_due == null ? null : Math.max(0,Number(r.registration_due)-Number(r.registration_paid)))}</td><td>${feeStatus(Number(r.registration_paid || 0)>0 ? "paid" : "unpaid")}</td></tr>`).join("")}</tbody></table>
`;
 box.innerHTML=`<h4>Yuran Ahli ${escapeHtml(String(paidYearSummary.year))}</h4><p>Bawah 60 tahun RM30; 60 tahun ke atas RM20. Rekod lama menggunakan jumlah bayaran tersimpan sebagai kadar paparan. Bayaran baharu menggunakan kategori pilihan ahli; lebihan dibawa ke tahun berikutnya dan baki separa tetap direkodkan. Status Sudah Bayar bermaksud ada rekod bayaran.</p>
 <table class="admin-table"><thead><tr><th>Nama Ahli</th><th>Kadar Tahun Ini</th><th>Bayaran Diperuntukkan</th><th>Baki</th><th>Status</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHtml(r.member_name)}</td><td>${r.annual_due == null ? "—" : money(r.annual_due)}</td><td>${money(r.annual_paid)}</td><td>${r.annual_due == null ? "—" : money(Math.max(0,Number(r.annual_due)-Number(r.annual_paid)))}</td><td>${feeStatus(Number(r.annual_paid || 0)>0 ? "paid" : "unpaid")}</td></tr>`).join("")}</tbody></table>`;
}



async function handleAdminAction(event) {
  const button = event.currentTarget;
  const card = button.closest(".admin-card");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sedang proses...";

  try {
    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "approve-membership") await approveMembership(id);
    if (action === "open-ic-proof") {
      await openIcProof(button.dataset.path || "");
      button.disabled = false;
      button.textContent = "Buka gambar IC";
      return;
    }
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
    button.textContent = originalText;
  }
}

async function approveMembership(id) {
  const [record] = await supabaseRequest(`membership_checks?id=eq.${id}&select=*`);

  if (!record) throw new Error("Permohonan tidak dijumpai.");
  if (record.status === "approved") return;

  if (record.check_type === "daftar") {
    const existing = await supabaseRequest(`members?source_submission_id=eq.${encodeURIComponent(id)}&select=id&limit=2`);
    if (!existing.length) {
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
    const saved = await supabaseRequest(`members?source_submission_id=eq.${encodeURIComponent(id)}&select=id&limit=2`);
    if (saved.length !== 1) throw new Error("Rekod ahli belum disimpan dengan tepat. Kelulusan dihentikan.");
  }
  await updateStatus("membership_checks", id, "approved");
}

async function openIcProof(path) {
  if (!path) {
    throw new Error("Path gambar IC tidak dijumpai.");
  }

  const result = await callEdgeFunction("ic-proof-storage", {
    action: "signed-url",
    path
  });

  if (!result?.signed_url) {
    throw new Error("Signed URL gambar IC gagal dijana.");
  }

  window.open(result.signed_url, "_blank", "noopener");
}

async function approveDependant(id) {
  const result = await supabaseRpc("approve_member_update", { p_update_id: id });
  if (!["applied", "already_applied"].includes(result?.status)) throw new Error("Simpanan belum dapat disahkan. Permohonan tidak dianggap selesai.");
  alert("Maklumat berjaya disimpan pada rekod ahli. Semakan menggunakan maklumat terkini.");
}


async function resolveUpdateMember(update) {
  const identifier = String(update.member_identifier || "").trim();
  const name = String(update.member_name || "").trim();
  let matches = [];
  if (identifier) {
    const variants = new Set([identifier]);
    const digits = identifier.replace(/\D/g, "");
    if (digits.length >= 7) {
      variants.add(digits);
      if (digits.length === 12) variants.add(digits.slice(0, 6) + "-" + digits.slice(6, 8) + "-" + digits.slice(8));
      if (digits.startsWith("01")) variants.add(digits.slice(0, 3) + "-" + digits.slice(3));
    }
    const terms = [...variants].flatMap(value => ["member_no", "ic_no", "phone"].map(field => field + ".eq." + JSON.stringify(value)));
    matches = await supabaseRequest("members?or=" + encodeURIComponent("(" + terms.join(",") + ")") + "&select=id,member_no,member_name&limit=2");
  } else if (name) {
    matches = await supabaseRequest("members?member_name=eq." + encodeURIComponent(name) + "&select=id,member_no,member_name&limit=2");
  }
  if (matches.length !== 1) throw new Error(matches.length ? "Lebih daripada satu ahli sepadan. Sila semak IC atau telefon ahli." : "Rekod ahli tidak dijumpai. Sila semak IC atau telefon ahli sebelum luluskan.");
  return matches[0];
}

function memberMatchPath(identifier, memberName = "") {
  const value = encodeURIComponent(identifier || "");
  const name = encodeURIComponent(memberName || "");
  if (!value && !name) return "members?member_no=eq.__missing__";
  if (!value) return `members?member_name=eq.${name}`;
  if (!name || identifier === memberName) return `members?or=(member_no.eq.${value},ic_no.eq.${value},phone.eq.${value},member_name.eq.${value})`;
  return `members?or=(member_no.eq.${value},ic_no.eq.${value},phone.eq.${value},member_name.eq.${name})`;
}

async function findMemberForPayment(record) {
  if (record.member_id) {
    const [member] = await supabaseRequest("members?id=eq." + encodeURIComponent(record.member_id) + "&select=id,member_no,member_name,ic_no,phone&limit=1");
    if (!member) throw new Error("Rekod ahli untuk bayaran ini tidak dijumpai.");
    return member;
  }
  return resolveUpdateMember({ member_identifier: record.payer_identifier, member_name: record.payer_name });
}

async function approvePayment(id) {
 const card=document.querySelector(`[data-action="approve-payment"][data-id="${id}"]`)?.closest(".admin-card");
 const type=card?.querySelector("[data-fee-type]")?.value || "annual";
 const category=card?.querySelector("[data-rate-category]")?.value || null;
 if (!category) throw new Error("Pilih kategori kadar bayaran sebelum mengesahkan.");
 const plan=await supabaseRpc("preview_fee_payment_category",{p_payment_id:id,p_fee_type:type,p_rate_category:category});
 const text=plan.allocations.map(line=>`${line.fee_type === "registration" ? "Pendaftaran" : "Yuran ahli"} ${line.year}: ${formatMoney(line.amount)}${line.fee_type === "annual" ? " / kadar "+formatMoney(line.due) : ""}`).join("\n");
 if(!confirm(`Sahkan bayaran untuk ${plan.member_name}?\n\n${text}\n\nJumlah: ${formatMoney(plan.total)}\nLebihan diagih automatik mengikut tahun.`))throw new Error("Pengesahan dibatalkan.");
 const bankRef=prompt("Rujukan bank / catatan semakan (pilihan):","");
 if(bankRef === null)throw new Error("Pengesahan dibatalkan.");
 const result=await supabaseRpc("approve_fee_payment_category",{p_payment_id:id,p_fee_type:type,p_rate_category:category,p_bank_ref:bankRef.trim() || null,p_expected_allocations:plan.allocations});
 alert(`Bayaran berjaya disahkan. Resit: ${result.receipt_no}`);
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
              <td>${escapeHtml(displayStatus(record.status))}</td>
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
      <p><span>Status</span><strong>${escapeHtml(displayStatus(result.status))}</strong></p>
        <p><span>Tarikh</span><strong>${escapeHtml(formatReceiptDate(result.created_at))}</strong></p>
      </div>
      <dl class="receipt-lines">
        <div><dt>Nama Pembayar</dt><dd>${escapeHtml(result.payer_name || "-")}</dd></div>
        <div><dt>Kaedah Bayaran</dt><dd>${escapeHtml(displayPaymentMethod(result.payment_method))}</dd></div>
        <div><dt>Tahun Bayaran</dt><dd>${escapeHtml(result.payment_year || "-")}</dd></div>
        <div><dt>Jumlah</dt><dd>RM${escapeHtml(String(result.amount || "0"))}</dd></div>
      </dl>
      <p class="receipt-note">Resit ini dijana oleh sistem Khairat Surau Haji Kamaruddin selepas bayaran disahkan oleh admin.</p>
    </article>
    <button class="button button--primary receipt-print-button" type="button" onclick="window.print()">Cetak Resit</button>
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

function compactKey(value) {
  return normalKey(value).replace(/[^a-z0-9]/g, "");
}

function uniqueKeys(values) {
  return [...new Set(values.flatMap((value) => {
    const normal = normalKey(value);
    const compact = compactKey(value);
    return [normal, compact].filter(Boolean);
  }))];
}

function memberKeys(member) {
  return member.id ? [`member:${member.id}`] : uniqueKeys([member.member_no, member.member_name, member.ic_no, member.phone]);
}

function paymentKeys(payment) {
  return payment.member_id ? [`member:${payment.member_id}`] : [];
}

function submissionKeys(submission) {
  return submission.member_id ? [`member:${submission.member_id}`] : [];
}

function isIcDashFormat(value) {
  return /^\d{6}-\d{2}-\d{4}$/.test(String(value || "").trim());
}

function requireIcDashFormat(value, label) {
  const text = String(value || "").trim();
  if (text && !isIcDashFormat(text)) {
    throw new Error(`${label} mesti format XXXXXX-XX-XXXX, contoh XXXXXX-XX-XXXX.`);
  }
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatIcInput(value) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

function attachAutoFormatters() {
  document.querySelectorAll("[data-format='ic']").forEach((input) => {
    if (!(input instanceof HTMLInputElement) || input.dataset.autoFormatAttached === "true") return;
    input.dataset.autoFormatAttached = "true";
    input.addEventListener("input", () => {
      const formatted = formatIcInput(input.value);
      if (input.value !== formatted) input.value = formatted;
    });
  });
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

function feeStatus(status,pending=false) {
 const labels={paid:"Sudah Bayar",partial:"Bayaran Sebahagian",unpaid:"Belum Bayar",needs_ic:"Kategori Kadar Belum Ditetapkan"};
 return `<span class="status-pill ${status === "paid" ? "status-pill--success" : ""}">${labels[status] || "Belum Disemak"}</span>${pending ? "<small> · Ada bayaran menunggu pengesahan</small>" : ""}`;
}
