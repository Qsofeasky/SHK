const toggle = document.querySelector(".nav-toggle");
const menu = document.querySelector("#site-menu");

if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

const publicSections = [...document.querySelectorAll(".view-section")];

function showPublicSection(sectionId) {
  publicSections.forEach((section) => {
    section.hidden = section.id !== sectionId;
  });
}

function handlePublicRoute() {
  const sectionId = window.location.hash.replace("#", "");
  if (!sectionId || sectionId === "home") {
    publicSections.forEach((section) => {
      section.hidden = true;
    });
    return;
  }

  const target = document.getElementById(sectionId);
  if (target?.classList.contains("view-section")) {
    showPublicSection(sectionId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

window.addEventListener("hashchange", handlePublicRoute);
handlePublicRoute();

const supabase = {
  url: window.SHK_SUPABASE?.url || "",
  anonKey: window.SHK_SUPABASE?.anonKey || "",
  get ready() {
    return this.url.startsWith("https://") && this.anonKey.length > 20;
  }
};

const paymentYearInput = document.querySelector("#paymentYear");
if (paymentYearInput) {
  paymentYearInput.value = new Date().getFullYear();
}

async function insertRow(table, payload, options = {}) {
  if (!supabase.ready) {
    throw new Error("Supabase belum dikonfigurasi. Sila isi supabase-config.js dahulu.");
  }

  const response = await fetch(`${supabase.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`,
      Prefer: options.returning ? "return=representation" : "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Data gagal disimpan ke Supabase.");
  }

  return options.returning ? response.json() : null;
}

async function queueAdminReminder(subject, message) {
  try {
    await insertRow("reminder_queue", {
      reminder_type: "admin_pending",
      subject,
      message
    });
  } catch {
    // Form submission must still succeed even if reminder queue is not configured yet.
  }
}

async function callRpc(functionName, payload) {
  if (!supabase.ready) {
    throw new Error("Supabase belum dikonfigurasi. Sila isi supabase-config.js dahulu.");
  }

  const response = await fetch(`${supabase.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Semakan gagal.");
  }

  return response.json();
}

function setMessage(selector, text, type = "neutral") {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = text;
  node.className = `form-message form-message--${type}`;
}

function clearMessage(selector) {
  setMessage(selector, "", "neutral");
}

function showCheckAnswer(html) {
  const node = document.querySelector("#checkAnswer");
  if (!node) return;
  node.hidden = false;
  node.innerHTML = html;
}

function clearCheckAnswer() {
  const node = document.querySelector("#checkAnswer");
  if (!node) return;
  node.hidden = true;
  node.innerHTML = "";
}

const checkForm = document.querySelector("#checkForm");
const checkType = document.querySelector("#checkType");
const nameField = document.querySelector("#nameField");
const checkIdField = document.querySelector("#checkIdField");
const phoneField = document.querySelector("#phoneField");
const occupationField = document.querySelector("#occupationField");
const addressField = document.querySelector("#addressField");
const emailField = document.querySelector("#emailField");
const locationField = document.querySelector("#locationField");
let detectedLocation = null;

function syncDaftarFields() {
  if (!checkType) return;
  const show = checkType.value === "daftar";
  if (nameField) nameField.hidden = false;
  if (phoneField) phoneField.hidden = !show;
  if (occupationField) occupationField.hidden = !show;
  if (addressField) addressField.hidden = !show;
  if (emailField) emailField.hidden = !show;
  if (locationField) locationField.hidden = !show;
  const name = document.querySelector("#checkName");
  const id = document.querySelector("#checkId");
  const phone = document.querySelector("#checkPhone");
  const email = document.querySelector("#checkEmail");
  const occupation = document.querySelector("#checkOccupation");
  const address = document.querySelector("#checkAddress");
  if (name) name.required = true;
  if (id) {
    id.required = true;
    id.type = show ? "text" : "tel";
    id.placeholder = show ? "No. IC ahli baru" : "Masukkan no. telefon sahaja";
  }
  if (checkIdField) {
    checkIdField.childNodes[0].textContent = show ? "No. IC" : "No. Telefon";
  }
  if (phone) phone.required = show;
  if (email) email.required = show;
  if (occupation) occupation.required = show;
  if (address) address.required = show;
}

checkType?.addEventListener("change", () => {
  syncDaftarFields();
  clearMessage("#checkMessage");
  clearCheckAnswer();
});

syncDaftarFields();

if (checkForm) {
  checkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#checkName").value.trim();
    const typeInput = document.querySelector("#checkType");
    const id = document.querySelector("#checkId").value.trim();

    clearMessage("#checkMessage");
    clearCheckAnswer();

    try {
      const searchText = id;
      if (!name || !searchText) {
        throw new Error(typeInput.value === "daftar" ? "Masukkan nama dan no. IC ahli baru." : "Masukkan nama dan no. telefon untuk carian.");
      }

      if (typeInput.value === "status") {
        const [result] = await callRpc("check_member_status", { search_text: searchText });
        showCheckAnswer(`
          <span class="status-pill ${result.found ? "status-pill--success" : ""}">${escapeHtml(result.status)}</span>
          ${result.member_name ? `<h3>${escapeHtml(result.member_name)}</h3>` : ""}
          ${result.member_no ? `<p>No. Ahli: ${escapeHtml(result.member_no)}</p>` : ""}
          ${result.dependant_count !== null && result.dependant_count !== undefined ? `<p>Jumlah tanggungan: ${escapeHtml(String(result.dependant_count))}</p>` : ""}
        `);
        return;
      }

      if (typeInput.value === "bayaran") {
        const history = await callRpc("check_payment_history", { search_text: searchText });
        const [result] = history;
        const paymentRows = history
          .filter((row) => row.payment_year)
          .map((row) => `<li><span>${escapeHtml(String(row.payment_year))}</span><strong>RM${escapeHtml(String(row.amount || 0))}</strong></li>`)
          .join("");

        showCheckAnswer(`
          <span class="status-pill ${result.found ? "status-pill--success" : ""}">${escapeHtml(result.status)}</span>
          ${result.member_name ? `<h3>${escapeHtml(result.member_name)}</h3>` : ""}
          ${paymentRows ? `<ul class="payment-history">${paymentRows}</ul>` : ""}
        `);
        return;
      }

      await insertRow("membership_checks", {
        check_type: typeInput.value,
        member_name: name,
        member_identifier: id || null,
        phone: document.querySelector("#checkPhone").value.trim() || null,
        email: document.querySelector("#checkEmail").value.trim() || null,
        occupation: document.querySelector("#checkOccupation").value.trim() || null,
        address: document.querySelector("#checkAddress").value.trim() || null,
        location_latitude: detectedLocation?.latitude || null,
        location_longitude: detectedLocation?.longitude || null,
        location_url: detectedLocation?.url || null,
        kariah_confirmed: true
      });
      await queueAdminReminder("Semakan/daftar ahli baru", `Permohonan ${typeInput.value} diterima untuk ${name}.`);

      checkForm.reset();
      detectedLocation = null;
      setMessage("#locationMessage", "", "neutral");
      syncDaftarFields();
    } catch (error) {
      setMessage("#checkMessage", error.message, "error");
    }
  });
}

document.querySelector("#detectLocation")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setMessage("#locationMessage", "Browser ini tidak support location detection.", "error");
    return;
  }

  setMessage("#locationMessage", "Sedang ambil lokasi...", "neutral");
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    detectedLocation = {
      latitude,
      longitude,
      url: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
    setMessage("#locationMessage", "Lokasi berjaya disimpan bersama borang.", "success");
  }, () => {
    setMessage("#locationMessage", "Lokasi tidak dibenarkan. Borang masih boleh dihantar tanpa lokasi.", "error");
  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  });
});

const rows = document.querySelector("#dependantRows");
const addDependant = document.querySelector("#addDependant");

if (rows && addDependant) {
  addDependant.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "dependant-row";
    row.innerHTML = `
      <input type="text" placeholder="Nama penuh">
      <input type="text" placeholder="No. IC / sijil lahir">
      <select>
        <option></option>
        <option>Lelaki</option>
        <option>Perempuan</option>
      </select>
      <input type="number" min="0" placeholder="Umur">
      <input type="text" placeholder="Isteri / Suami / Anak / Ibu / Bapa">
      <select>
        <option>Tambah</option>
        <option>Kekal</option>
        <option>Buang</option>
      </select>
    `;
    rows.appendChild(row);
  });
}

const dependantForm = document.querySelector("#dependantForm");

if (dependantForm) {
  dependantForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#dependantMessage");

    const itemRows = [...document.querySelectorAll("#dependantRows .dependant-row:not(.dependant-row--head)")];
    const items = itemRows
      .map((row) => {
        const inputs = row.querySelectorAll("input");
        const selects = row.querySelectorAll("select");
        return {
          dependant_name: inputs[0]?.value.trim() || null,
          dependant_ic: inputs[1]?.value.trim() || null,
          gender: selects[0]?.value || null,
          age: Number(inputs[2]?.value) || null,
          relationship: inputs[3]?.value.trim() || null,
          item_status: selects[1]?.value || "Tambah"
        };
      })
      .filter((item) => item.dependant_name || item.dependant_ic || item.relationship || item.gender || item.age);

    try {
      const [update] = await insertRow("dependant_updates", {
        member_name: document.querySelector("#memberName").value.trim(),
        member_identifier: document.querySelector("#memberId").value.trim(),
        update_action: document.querySelector("#dependantAction").value,
        dependant_total: Number(document.querySelector("#dependantTotal").value) || null
      }, { returning: true });

      if (items.length) {
        await insertRow("dependant_update_items", items.map((item) => ({
          ...item,
          update_id: update.id
        })));
      }
      await queueAdminReminder("Kemaskini tanggungan baru", `Kemaskini tanggungan diterima untuk ${document.querySelector("#memberName").value.trim()}.`);

      dependantForm.reset();
    } catch (error) {
      setMessage("#dependantMessage", error.message, "error");
    }
  });
}

const paymentForm = document.querySelector("#paymentForm");
const proofType = document.querySelector("#proofType");
const receiptNoField = document.querySelector("#receiptNoField");
const receiptUploadField = document.querySelector("#receiptUploadField");

function syncProofFields() {
  const upload = proofType?.value === "upload";
  if (receiptNoField) receiptNoField.hidden = upload;
  if (receiptUploadField) receiptUploadField.hidden = !upload;
  const receiptNo = document.querySelector("#receiptNo");
  const receiptFile = document.querySelector("#receiptProofFile");
  if (receiptNo) receiptNo.required = !upload;
  if (receiptFile) receiptFile.required = upload;
}

proofType?.addEventListener("change", syncProofFields);
syncProofFields();

if (paymentForm) {
  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#paymentMessage");

    try {
      const proofFile = document.querySelector("#receiptProofFile")?.files?.[0] || null;
      const proofData = proofFile ? await readReceiptFile(proofFile) : null;

      await insertRow("payments", {
        payer_name: document.querySelector("#payerName").value.trim(),
        payer_identifier: document.querySelector("#payerIdentifier").value.trim() || null,
        payment_method: document.querySelector("#paymentMethod").value,
        payment_year: Number(document.querySelector("#paymentYear").value) || new Date().getFullYear(),
        amount: Number(document.querySelector("#paymentAmount").value) || null,
        receipt_no: document.querySelector("#receiptNo").value.trim() || null,
        receipt_proof_url: null,
        receipt_proof_data: proofData,
        receipt_proof_name: proofFile?.name || null,
        apply_excess_to_next_year: document.querySelector("#applyExcess").checked,
        note: document.querySelector("#paymentNote").value.trim() || null
      });
      await queueAdminReminder("Bayaran perlu verification", `Bayaran ${document.querySelector("#payerName").value.trim()} perlu disemak dengan resit/bank statement.`);

      paymentForm.reset();
      if (paymentYearInput) {
        paymentYearInput.value = new Date().getFullYear();
      }
      syncProofFields();
    } catch (error) {
      setMessage("#paymentMessage", error.message, "error");
    }
  });
}

function readReceiptFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 1500000) {
      reject(new Error("Saiz gambar resit maksimum 1.5MB. Sila compress gambar dahulu."));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Gambar resit gagal dibaca.")));
    reader.readAsDataURL(file);
  });
}

const donationForm = document.querySelector("#donationForm");

if (donationForm) {
  donationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#donationMessage");

    try {
      await insertRow("non_member_donations", {
        donor_name: document.querySelector("#donorName").value.trim(),
        phone: document.querySelector("#donorPhone").value.trim() || null,
        payment_method: document.querySelector("#donationMethod").value,
        amount: Number(document.querySelector("#donationAmount").value) || null,
        receipt_no: null,
        receipt_proof_url: null,
        note: document.querySelector("#donationNote").value.trim() || null
      });
      await queueAdminReminder("Sumbangan bukan ahli", `Sumbangan daripada ${document.querySelector("#donorName").value.trim()} perlu verification.`);

      donationForm.reset();
    } catch (error) {
      setMessage("#donationMessage", error.message, "error");
    }
  });
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
