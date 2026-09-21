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
  const currentYear = String(new Date().getFullYear());
  if ([...paymentYearInput.options].some((option) => option.value === currentYear)) {
    paymentYearInput.value = currentYear;
  }
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

function isPhoneFormat(value) {
  return /^01\d-\d{6,8}$/.test(String(value || "").trim());
}

function hasDash(value) {
  return String(value || "").includes("-");
}

function requirePhoneFormat(value, label) {
  const text = String(value || "").trim();
  if (text && !isPhoneFormat(text)) {
    throw new Error(`${label} mesti format 01X-XXXXXX, contoh 01X-XXXXXX.`);
  }
}

function requireIcDashFormat(value, label) {
  const text = String(value || "").trim();
  if (text && !/^\d{6}-\d{2}-\d{4}$/.test(text)) {
    throw new Error(`${label} mesti format XXXXXX-XX-XXXX, contoh XXXXXX-XX-XXXX.`);
  }
}

function requirePhoneOrIcFormat(value, label) {
  const text = String(value || "").trim();
  if (!text) return;
  if (text.startsWith("01")) {
    requirePhoneFormat(text, label);
  } else {
    requireIcDashFormat(text, label);
  }
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
const residenceTypeField = document.querySelector("#residenceTypeField");
const icProofField = document.querySelector("#icProofField");
let detectedLocation = null;
let pendingRegistrationPayload = null;

function locationUrlFromAddress(address) {
  const text = String(address || "").trim();
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}

function syncDaftarFields() {
  if (!checkType) return;
  const show = checkType.value === "daftar";
  if (nameField) nameField.hidden = false;
  if (phoneField) phoneField.hidden = !show;
  if (occupationField) occupationField.hidden = !show;
  if (addressField) addressField.hidden = !show;
  if (emailField) emailField.hidden = !show;
  if (locationField) locationField.hidden = !show;
  if (residenceTypeField) residenceTypeField.hidden = !show;
  if (icProofField) icProofField.hidden = !show;
  const name = document.querySelector("#checkName");
  const id = document.querySelector("#checkId");
  const phone = document.querySelector("#checkPhone");
  const email = document.querySelector("#checkEmail");
  const occupation = document.querySelector("#checkOccupation");
  const address = document.querySelector("#checkAddress");
  const residenceType = document.querySelector("#residenceType");
  const icProof = document.querySelector("#icProofFile");
  if (name) name.required = true;
  if (id) {
    id.required = true;
    id.type = "text";
    id.inputMode = show ? "text" : "tel";
    id.placeholder = show ? "IC format XXXXXX-XX-XXXX, contoh: XXXXXX-XX-XXXX" : "Contoh: 01X-XXXXXX";
    id.title = show ? "No. IC mesti format XXXXXX-XX-XXXX." : "No. telefon mesti format 01X-XXXXXX.";
  }
  if (checkIdField) {
    checkIdField.childNodes[0].textContent = show ? "No. IC" : "No. Telefon";
  }
  if (phone) phone.required = show;
  if (email) email.required = show;
  if (occupation) occupation.required = show;
  if (address) address.required = show;
  if (residenceType) residenceType.required = show;
  if (icProof) icProof.required = show;

  if (!show) {
    detectedLocation = null;
    pendingRegistrationPayload = null;
    setMessage("#locationMessage", "", "neutral");
  }
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


      if (typeInput.value === "daftar") {
        requireIcDashFormat(searchText, "No. IC");
        requirePhoneFormat(document.querySelector("#checkPhone").value.trim(), "No. telefon");
      } else {
        requirePhoneFormat(searchText, "No. telefon");
      }

      if (typeInput.value === "status") {
        const [result] = await callRpc("check_member_status", { search_text: searchText });
        let dependantList = "";

        if (result.found) {
          try {
            const dependants = await callRpc("check_member_dependants", { search_text: searchText });
            dependantList = dependants.length
              ? `<h4>Senarai ahli tanggungan</h4><ul class="payment-history">${dependants.map((item) => `<li><span>${escapeHtml(item.dependant_name || "-")}</span><strong>${escapeHtml(item.relationship || "-")}</strong></li>`).join("")}</ul>`
              : `<p>Tiada rekod ahli tanggungan.</p>`;
          } catch {
            dependantList = "";
          }
        }

        showCheckAnswer(`
          <span class="status-pill ${result.found ? "status-pill--success" : ""}">${escapeHtml(result.status)}</span>
          ${result.member_name ? `<h3>${escapeHtml(result.member_name)}</h3>` : ""}
          ${result.member_no ? `<p>No. Ahli: ${escapeHtml(result.member_no)}</p>` : ""}
          ${result.dependant_count !== null && result.dependant_count !== undefined ? `<p>Jumlah tanggungan: ${escapeHtml(String(result.dependant_count))}</p>` : ""}
          ${dependantList}
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

      const addressValue = document.querySelector("#checkAddress").value.trim();
      const icProofFile = document.querySelector("#icProofFile")?.files?.[0] || null;
      const icProofData = icProofFile ? await readImageFile(icProofFile, "Gambar IC") : null;
      pendingRegistrationPayload = {
        check_type: typeInput.value,
        member_name: name,
        member_identifier: id || null,
        phone: document.querySelector("#checkPhone").value.trim() || null,
        email: document.querySelector("#checkEmail").value.trim() || null,
        occupation: document.querySelector("#checkOccupation").value.trim() || null,
        address: addressValue || null,
        residence_type: document.querySelector("#residenceType")?.value || null,
        location_latitude: detectedLocation?.latitude || null,
        location_longitude: detectedLocation?.longitude || null,
        location_url: detectedLocation?.url || locationUrlFromAddress(addressValue),
        ic_proof_data: icProofData,
        ic_proof_name: icProofFile?.name || null,
        kariah_confirmed: true
      };

      showCheckAnswer(`
        <h3>Semak Maklumat Sebelum Hantar</h3>
        <p><strong>Jenis semakan:</strong> Daftar ahli baru</p>
        <p><strong>Nama:</strong> ${escapeHtml(name)}</p>
        <p><strong>No. IC:</strong> ${escapeHtml(id)}</p>
        <p><strong>No. Telefon:</strong> ${escapeHtml(pendingRegistrationPayload.phone || "-")}</p>
        <p><strong>Email:</strong> ${escapeHtml(pendingRegistrationPayload.email || "-")}</p>
        <p><strong>Pekerjaan:</strong> ${escapeHtml(pendingRegistrationPayload.occupation || "-")}</p>
        <p><strong>Alamat Rumah Sekarang:</strong> ${escapeHtml(addressValue || "-")}</p>
        <p><strong>Status Alamat Rumah:</strong> ${escapeHtml(pendingRegistrationPayload.residence_type || "-")}</p>
        <p><strong>Lokasi Kediaman Sekarang:</strong> ${detectedLocation ? "Lokasi semasa telefon digunakan." : "Pautan lokasi dijana daripada alamat rumah."}</p>
        <p><strong>Gambar IC:</strong> ${escapeHtml(pendingRegistrationPayload.ic_proof_name || "-")}</p>
        <button class="button button--primary" id="confirmRegistration" type="button">Sahkan dan Hantar Daftar Ahli Baru</button>
      `);
      setMessage("#checkMessage", "Sila semak maklumat. Tekan butang pengesahan jika semuanya betul.", "neutral");
    } catch (error) {
      setMessage("#checkMessage", error.message, "error");
    }
  });
}

document.querySelector("#checkAnswer")?.addEventListener("click", async (event) => {
  if (!(event.target instanceof HTMLElement) || event.target.id !== "confirmRegistration") return;
  if (!pendingRegistrationPayload) return;

  clearMessage("#checkMessage");
  try {
    await insertRow("membership_checks", pendingRegistrationPayload);
    await queueAdminReminder("Semakan/daftar ahli baru", `Permohonan daftar ahli baru diterima untuk ${pendingRegistrationPayload.member_name}.`);
    checkForm?.reset();
    detectedLocation = null;
    pendingRegistrationPayload = null;
    setMessage("#locationMessage", "", "neutral");
    syncDaftarFields();
    showCheckAnswer(`<span class="status-pill status-pill--success">Permohonan berjaya dihantar.</span><p>Admin akan semak gambar IC dan maklumat pendaftaran.</p>`);
    setMessage("#checkMessage", "", "neutral");
  } catch (error) {
    setMessage("#checkMessage", error.message, "error");
  }
});

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

const dependantAction = document.querySelector("#dependantAction");
const memberNameField = document.querySelector("#memberNameField");
const memberIdField = document.querySelector("#memberIdField");
const dependantNewNameField = document.querySelector("#dependantNewNameField");
const dependantNewPhoneField = document.querySelector("#dependantNewPhoneField");
const dependantNewIcField = document.querySelector("#dependantNewIcField");
const dependantAddressField = document.querySelector("#dependantAddressField");
const dependantLocationField = document.querySelector("#dependantLocationField");
const dependantTotalField = document.querySelector("#dependantTotalField");
const rows = document.querySelector("#dependantRows");
const addDependant = document.querySelector("#addDependant");
let dependantDetectedLocation = null;

function isDependantRowAction() {
  return ["Tambah Tanggungan", "Kurangkan Tanggungan", "Kemaskini Maklumat Tanggungan"].includes(dependantAction?.value || "");
}

function dependantDefaultStatus() {
  if (dependantAction?.value === "Kurangkan Tanggungan") return "Buang";
  if (dependantAction?.value === "Kemaskini Maklumat Tanggungan") return "Kemaskini";
  return "Tambah";
}

function syncDependantFields() {
  const showSelfUpdate = dependantAction?.value === "Kemaskini Maklumat Diri";
  const rowAction = isDependantRowAction();

  if (memberNameField) memberNameField.childNodes[0].textContent = rowAction ? "Nama Ahli" : "Nama Ahli Lama (jika ingat)";
  if (memberIdField) memberIdField.hidden = false;
  if (dependantNewNameField) dependantNewNameField.hidden = !showSelfUpdate;
  if (dependantNewPhoneField) dependantNewPhoneField.hidden = !showSelfUpdate;
  if (dependantNewIcField) dependantNewIcField.hidden = !showSelfUpdate;
  if (dependantAddressField) dependantAddressField.hidden = !showSelfUpdate;
  if (dependantLocationField) dependantLocationField.hidden = !showSelfUpdate;
  if (dependantTotalField) dependantTotalField.hidden = !rowAction;
  if (rows) rows.hidden = !rowAction;
  if (addDependant) addDependant.hidden = !rowAction;

  const memberName = document.querySelector("#memberName");
  const memberIdentifier = document.querySelector("#memberId");
  const dependantTotal = document.querySelector("#dependantTotal");
  if (memberName) {
    memberName.required = rowAction;
    memberName.placeholder = rowAction ? "Nama ahli" : "Isi jika ingat nama lama";
  }
  if (memberIdentifier) memberIdentifier.required = showSelfUpdate || rowAction;
  if (dependantTotal) dependantTotal.required = rowAction;

  document.querySelectorAll("#dependantRows .dependant-row:not(.dependant-row--head) select:last-child").forEach((select) => {
    select.value = dependantDefaultStatus();
  });

  if (!showSelfUpdate) {
    dependantDetectedLocation = null;
    setMessage("#dependantLocationMessage", "", "neutral");
  }
}

function addDependantRow() {
  if (!rows) return;
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
      <option>Buang</option>
      <option>Kemaskini</option>
    </select>
  `;
  rows.appendChild(row);
  row.querySelector("select:last-child").value = dependantDefaultStatus();
}

addDependant?.addEventListener("click", addDependantRow);

dependantAction?.addEventListener("change", () => {
  syncDependantFields();
  clearMessage("#dependantMessage");
});

syncDependantFields();

const dependantForm = document.querySelector("#dependantForm");

if (dependantForm) {
  dependantForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#dependantMessage");

    try {
      const memberName = document.querySelector("#memberName").value.trim();
      const memberIdentifier = document.querySelector("#memberId").value.trim();
      const action = document.querySelector("#dependantAction").value;
      const rowAction = isDependantRowAction();

      if (rowAction && !memberName) {
        throw new Error("Masukkan nama ahli.");
      }

      if (!memberIdentifier) {
        throw new Error("Masukkan no. telefon atau IC ahli sebagai rujukan.");
      }
      requirePhoneOrIcFormat(memberIdentifier, "No. telefon / IC ahli");

      const updatePayload = {
        id: crypto.randomUUID(),
        member_name: memberName || memberIdentifier,
        member_identifier: memberIdentifier,
        phone: memberIdentifier,
        update_action: action,
        dependant_total: rowAction ? Number(document.querySelector("#dependantTotal")?.value) || null : null
      };

      let items = [];

      if (rowAction) {
        items = [...document.querySelectorAll("#dependantRows .dependant-row:not(.dependant-row--head)")]
          .map((row) => {
            const inputs = row.querySelectorAll("input");
            const selects = row.querySelectorAll("select");
            return {
              update_id: updatePayload.id,
              dependant_name: inputs[0]?.value.trim() || null,
              dependant_ic: inputs[1]?.value.trim() || null,
              gender: selects[0]?.value || null,
              age: Number(inputs[2]?.value) || null,
              relationship: inputs[3]?.value.trim() || null,
              item_status: selects[1]?.value || dependantDefaultStatus()
            };
          })
          .filter((item) => item.dependant_name || item.dependant_ic || item.relationship || item.gender || item.age);

        items.forEach((item) => requireIcDashFormat(item.dependant_ic, "No. IC tanggungan"));

        if (!items.length) {
          throw new Error("Isi sekurang-kurangnya satu maklumat tanggungan.");
        }
      } else {
        updatePayload.new_name = document.querySelector("#dependantNewName")?.value.trim() || null;
        updatePayload.new_phone = document.querySelector("#dependantNewPhone")?.value.trim() || null;
        updatePayload.new_ic = document.querySelector("#dependantNewIc")?.value.trim() || null;
        updatePayload.new_address = document.querySelector("#dependantNewAddress")?.value.trim() || null;

        requirePhoneFormat(updatePayload.new_phone, "No. telefon baru");
        requireIcDashFormat(updatePayload.new_ic, "IC baru");

        if (!updatePayload.new_name && !updatePayload.new_phone && !updatePayload.new_ic && !updatePayload.new_address && !dependantDetectedLocation) {
          throw new Error("Isi sekurang-kurangnya satu maklumat baru untuk dikemaskini.");
        }

        if (dependantDetectedLocation) {
          updatePayload.location_latitude = dependantDetectedLocation.latitude;
          updatePayload.location_longitude = dependantDetectedLocation.longitude;
          updatePayload.location_url = dependantDetectedLocation.url;
        } else if (updatePayload.new_address) {
          updatePayload.location_url = locationUrlFromAddress(updatePayload.new_address);
        }
      }

      await insertRow("dependant_updates", updatePayload);
      if (items.length) await insertRow("dependant_update_items", items);
      await queueAdminReminder("Kemaskini maklumat baru", `Kemaskini maklumat diterima untuk ${memberName || memberIdentifier}.`);

      dependantForm.reset();
      dependantDetectedLocation = null;
      syncDependantFields();
      setMessage("#dependantLocationMessage", "", "neutral");
      setMessage("#dependantMessage", "Kemaskini berjaya dihantar untuk admin approval.", "success");
    } catch (error) {
      setMessage("#dependantMessage", error.message, "error");
    }
  });
}
document.querySelector("#detectDependantLocation")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setMessage("#dependantLocationMessage", "Browser ini tidak support location detection.", "error");
    return;
  }

  setMessage("#dependantLocationMessage", "Sedang ambil lokasi...", "neutral");
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    dependantDetectedLocation = {
      latitude,
      longitude,
      url: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
    setMessage("#dependantLocationMessage", "Lokasi baru berjaya disimpan bersama borang.", "success");
  }, () => {
    setMessage("#dependantLocationMessage", "Lokasi tidak dibenarkan. Borang masih boleh dihantar dengan alamat sahaja.", "error");
  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  });
});

const paymentForm = document.querySelector("#paymentForm");

if (paymentForm) {
  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#paymentMessage");

    try {
      const payerPhone = document.querySelector("#payerIdentifier").value.trim();
      const bank = document.querySelector("#paymentBank")?.value.trim() || "";
      const remark = document.querySelector("#paymentRemark")?.value.trim() || "";
      const note = [remark, bank ? `Bank: ${bank}` : ""].filter(Boolean).join(" | ");
      requirePhoneFormat(payerPhone, "No. telefon");

      await insertRow("payments", {
        payer_name: document.querySelector("#payerName").value.trim(),
        payer_identifier: payerPhone || null,
        payment_method: document.querySelector("#paymentMethod").value,
        payment_year: Number(document.querySelector("#paymentYear").value) || new Date().getFullYear(),
        amount: Number(document.querySelector("#paymentAmount").value) || null,
        receipt_no: null,
        receipt_proof_url: null,
        receipt_proof_data: null,
        receipt_proof_name: null,
        bank_statement_ref: bank || null,
        apply_excess_to_next_year: document.querySelector("#applyExcess").checked,
        note: note || document.querySelector("#paymentNote")?.value.trim() || null
      });
      await queueAdminReminder("Bayaran perlu verification", `Bayaran ${document.querySelector("#payerName").value.trim()} perlu disemak dengan bank statement.`);

      paymentForm.reset();
      if (paymentYearInput) {
        const currentYear = String(new Date().getFullYear());
        if ([...paymentYearInput.options].some((option) => option.value === currentYear)) {
          paymentYearInput.value = currentYear;
        }
      }
    } catch (error) {
      setMessage("#paymentMessage", error.message, "error");
    }
  });
}

function readImageFile(file, label = "Gambar") {
  return new Promise((resolve, reject) => {
    if (file.size > 1500000) {
      reject(new Error(`Saiz ${label.toLowerCase()} maksimum 1.5MB. Sila compress gambar dahulu.`));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error(`${label} gagal dibaca.`)));
    reader.readAsDataURL(file);
  });
}

function parseReceiptNo(receipt) {
  const text = String(receipt || "").trim();
  const full = text.match(/^SHK\s*-\s*(\d{1,4})\/(\d{4})$/i);
  if (full) return { number: Number(full[1]), year: Number(full[2]) };
  if (/^\d{1,4}$/.test(text)) return { number: Number(text), year: new Date().getFullYear() };
  return null;
}

function normalizeReceiptSearch(input) {
  const parsed = parseReceiptNo(input);
  if (!parsed) return String(input || "").trim();
  return `SHK-${String(parsed.number || 1).padStart(4, "0")}/${parsed.year}`;
}

document.querySelector("#publicReceiptButton")?.addEventListener("click", async () => {
  const answer = document.querySelector("#publicReceiptAnswer");
  const receiptSearch = normalizeReceiptSearch(document.querySelector("#publicReceiptSearch")?.value || "");
  if (!answer) return;

  answer.hidden = false;
  answer.innerHTML = "Sedang mencari resit...";

  try {
    const [result] = await callRpc("check_receipt_status", { receipt_search: receiptSearch });
    if (!result?.found) {
      answer.innerHTML = `<span class="status-pill">Resit tidak dijumpai</span>`;
      return;
    }

    answer.innerHTML = `
      <article class="official-receipt">
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
          ${result.payment_year ? `<div><dt>Tahun Bayaran</dt><dd>${escapeHtml(String(result.payment_year))}</dd></div>` : ""}
          <div><dt>Jumlah</dt><dd>RM${escapeHtml(String(result.amount || 0))}</dd></div>
        </dl>
        <p class="receipt-note">Resit ini dijana oleh sistem Khairat Surau Haji Kamaruddin selepas bayaran disahkan oleh admin.</p>
      </article>
      <button class="button button--primary receipt-print-button" type="button" onclick="window.print()">Cetak Resit</button>
    `;
  } catch (error) {
    answer.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
});

function formatReceiptDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ms-MY");
}

const donationForm = document.querySelector("#donationForm");

if (donationForm) {
  donationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#donationMessage");

    try {
      const donationBank = document.querySelector("#donationBank")?.value.trim() || "";
      const donationNote = document.querySelector("#donationNote").value.trim();
      const note = [donationNote, donationBank ? `Bank: ${donationBank}` : ""].filter(Boolean).join(" | ");
      await insertRow("non_member_donations", {
        phone: (() => { const value = document.querySelector("#donorPhone").value.trim(); requirePhoneFormat(value, "No. telefon"); return value || null; })(),
        donor_name: document.querySelector("#donorName").value.trim(),

        payment_method: document.querySelector("#donationMethod").value,
        amount: Number(document.querySelector("#donationAmount").value) || null,
        receipt_no: null,
        receipt_proof_url: null,
        note: note || null
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
