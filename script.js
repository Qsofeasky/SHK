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

const supabase = {
  url: window.SHK_SUPABASE?.url || "",
  anonKey: window.SHK_SUPABASE?.anonKey || "",
  get ready() {
    return this.url.startsWith("https://") && this.anonKey.length > 20;
  }
};

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
const occupationField = document.querySelector("#occupationField");
const addressField = document.querySelector("#addressField");

function syncDaftarFields() {
  if (!checkType) return;
  const show = checkType.value === "daftar";
  if (occupationField) occupationField.hidden = !show;
  if (addressField) addressField.hidden = !show;
  const occupation = document.querySelector("#checkOccupation");
  const address = document.querySelector("#checkAddress");
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
      const searchText = id || name;

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
        occupation: document.querySelector("#checkOccupation").value.trim() || null,
        address: document.querySelector("#checkAddress").value.trim() || null,
        kariah_confirmed: true
      });

      checkForm.reset();
    } catch (error) {
      setMessage("#checkMessage", error.message, "error");
    }
  });
}

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

      dependantForm.reset();
    } catch (error) {
      setMessage("#dependantMessage", error.message, "error");
    }
  });
}

const paymentForm = document.querySelector("#paymentForm");

if (paymentForm) {
  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("#paymentMessage");

    try {
      await insertRow("payments", {
        payer_name: document.querySelector("#payerName").value.trim(),
        payment_method: document.querySelector("#paymentMethod").value,
        amount: Number(document.querySelector("#paymentAmount").value) || null,
        note: document.querySelector("#paymentNote").value.trim() || null
      });

      paymentForm.reset();
    } catch (error) {
      setMessage("#paymentMessage", error.message, "error");
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
