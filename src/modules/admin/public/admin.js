console.log("[admin.js] script loaded");

const API = "/admin/api";

function fmt(n) {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(n || 0));
}
function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : "-";
}
function statusChip(s) {
  const up = (s || "").toUpperCase();
  if (up === "COMPLETED") return `<span class="chip completed">COMPLETED</span>`;
  if (["FAILED", "CANCELLED"].includes(up)) return `<span class="chip failed">${up}</span>`;
  return `<span class="chip pending">${up || "-"}</span>`;
}

/* ── Auth ── */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
  });
  if (res.status === 401 || res.status === 403) {
    showLogin();
    throw new Error("AUTH");
  }
  return res;
}

function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("adminMain").classList.add("hidden");
  // 로그인 Step1으로 초기화
  document.getElementById("loginStep1").classList.remove("hidden");
  document.getElementById("loginStep2Setup").classList.add("hidden");
  document.getElementById("loginStep2Verify").classList.add("hidden");
  document.getElementById("loginPw").value = "";
}
function showAdmin() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminMain").classList.remove("hidden");
}

/* ── Dashboard ── */
async function loadDashboard() {
  try {
    const [settingsRes, statsRes] = await Promise.all([
      apiFetch(`${API}/settings`),
      apiFetch(`${API}/stats`),
    ]);
    const settingsData = await settingsRes.json();
    const statsData = await statsRes.json();

    const settings = settingsData.settings || [];
    const settlementSetting = settings.find((s) => s.key === "settlement_enabled");
    const enabled = settlementSetting?.value === "true";
    const toggle = document.getElementById("settlementToggle");
    toggle.checked = enabled;
    document.getElementById("settlementStatus").textContent = enabled ? "ON" : "OFF";

    const s = statsData.stats || {};
    document.getElementById("statAmbassadors").textContent = fmt(s.total_ambassadors);
    document.getElementById("statEarned").textContent = fmt(s.total_earned) + " pts";
    document.getElementById("statWithdrawn").textContent = fmt(s.total_withdrawn) + " pts";
    document.getElementById("statCurrent").textContent = fmt(s.total_current_points) + " pts";

    loadAmbassadors();
  } catch (e) {
    if (e.message !== "AUTH") console.error("loadDashboard error:", e);
  }
}

/* ── Ambassador list ── */
async function loadAmbassadors(query) {
  try {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await apiFetch(`${API}/ambassadors${q}`);
    const data = await res.json();
    const tbody = document.getElementById("ambBody");

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="emptyMsg">No ambassadors found</td></tr>`;
      return;
    }

    tbody.innerHTML = data.items.map((a) => `
      <tr>
        <td><span class="clickable" data-amb-id="${a.id}">${a.id}</span></td>
        <td>${a.name || "-"}</td>
        <td>${a.email || "-"}</td>
        <td>${a.grade_name || "-"}</td>
        <td>${fmt(a.current_points)}</td>
        <td>${fmt(a.total_earned)}</td>
        <td>${fmt(a.total_withdrawn)}</td>
        <td>${a.status || "-"}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" class="ambSettlementToggle" data-amb-id="${a.id}" ${a.settlement_enabled ? "checked" : ""} />
            <span class="slider"></span>
          </label>
        </td>
      </tr>
    `).join("");

    // Settlement toggle per ambassador
    tbody.querySelectorAll(".ambSettlementToggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const ambId = e.target.dataset.ambId;
        try {
          await apiFetch(`${API}/ambassadors/${ambId}/settlement`, {
            method: "PUT",
            body: JSON.stringify({ enabled: e.target.checked }),
          });
        } catch (err) {
          if (err.message !== "AUTH") {
            e.target.checked = !e.target.checked;
            alert("Failed to update");
          }
        }
      });
    });

    tbody.querySelectorAll(".clickable").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("pointsAmbId").value = el.dataset.ambId;
        document.querySelector('[data-tab="points"]').click();
        document.getElementById("btnPointsLookup").click();
      });
    });
  } catch (e) {
    if (e.message !== "AUTH") console.error("loadAmbassadors error:", e);
  }
}

/* ── Transfers ── */
let transferPage = 0;
const TRANSFER_LIMIT = 30;
let transferFilter = null;

async function loadTransfers() {
  try {
    const params = new URLSearchParams({ limit: TRANSFER_LIMIT, offset: transferPage * TRANSFER_LIMIT });
    if (transferFilter) params.set("ambassador_id", transferFilter);
    const res = await apiFetch(`${API}/transfers?${params}`);
    const data = await res.json();
    const tbody = document.getElementById("transferBody");

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="emptyMsg">No transfers found</td></tr>`;
      updateTransferPagination(0);
      return;
    }

    tbody.innerHTML = data.items.map((t) => `
      <tr>
        <td>${t.idx}</td>
        <td><span class="clickable" data-amb-id="${t.ambassador_idx}">${t.ambassador_name || t.ambassador_idx}</span></td>
        <td>${t.ambassador_email || "-"}</td>
        <td>${fmt(t.transfer_amount)}</td>
        <td>${t.transfer_currency || "-"}</td>
        <td>${statusChip(t.status)}</td>
        <td>${fmtDate(t.created_at)}</td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".clickable").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("pointsAmbId").value = el.dataset.ambId;
        document.querySelector('[data-tab="points"]').click();
        document.getElementById("btnPointsLookup").click();
      });
    });

    updateTransferPagination(data.total);
  } catch (e) {
    if (e.message !== "AUTH") console.error("loadTransfers error:", e);
  }
}

function updateTransferPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / TRANSFER_LIMIT));
  document.getElementById("transferPageInfo").textContent = `${transferPage + 1} / ${totalPages}`;
  document.getElementById("transferPrev").disabled = transferPage === 0;
  document.getElementById("transferNext").disabled = (transferPage + 1) >= totalPages;
}

/* ── Excel Export ── */
async function handleExportExcel() {
  console.log("[admin] Excel Download button clicked");

  const params = new URLSearchParams();
  const startDate = document.getElementById("exportStart").value;
  const endDate = document.getElementById("exportEnd").value;
  console.log("[admin] export filters:", { startDate, endDate, transferFilter });

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (transferFilter) params.set("ambassador_id", transferFilter);

  const btn = document.getElementById("btnExportExcel");
  btn.disabled = true;
  btn.textContent = "Downloading...";

  try {
    const url = `${API}/transfers/export?${params}`;
    console.log("[admin] export fetch URL:", url);
    const res = await fetch(url, { credentials: "include" });
    console.log("[admin] export response status:", res.status);

    if (res.status === 401 || res.status === 403) { showLogin(); return; }
    if (!res.ok) { alert("Export failed (status: " + res.status + ")"); return; }

    const blob = await res.blob();
    console.log("[admin] blob size:", blob.size);
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `transfers_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
    console.log("[admin] download triggered");
  } catch (err) {
    console.error("[admin] export error:", err);
    alert("Download failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Excel Download";
  }
}

/* ── Points Management ── */
let currentAmbId = null;

async function loadTransactionHistory(id) {
  try {
    const res = await apiFetch(`${API}/ambassadors/${id}/transactions`);
    const data = await res.json();
    const tbody = document.getElementById("txBody");

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="emptyMsg">No transactions</td></tr>`;
      return;
    }

    tbody.innerHTML = data.items.map((t) => `
      <tr>
        <td>${fmtDate(t.created_at)}</td>
        <td>${t.type || "-"}</td>
        <td style="color:${t.amount >= 0 ? 'var(--success)' : 'var(--danger)'}">${t.amount >= 0 ? "+" : ""}${fmt(t.amount)}</td>
        <td>${fmt(t.balance_after)}</td>
        <td>${t.reference_type || "-"}</td>
        <td>${t.description || "-"}</td>
      </tr>
    `).join("");
  } catch (e) {
    if (e.message !== "AUTH") console.error("loadTx error:", e);
  }
}

/* ── Tax Info ── */
async function loadTaxInfo(id) {
  const section = document.getElementById("taxInfoSection");
  const grid = document.getElementById("taxInfoGrid");

  try {
    const res = await apiFetch(`${API}/ambassadors/${id}/tax-info`);
    const data = await res.json();

    if (!data.exists) {
      section.classList.remove("hidden");
      grid.innerHTML = `<div class="detailItem"><span class="dlabel">Status</span><br/><span class="dvalue" style="color:#c00;">미등록</span></div>`;
      return;
    }

    const t = data.tax_info;
    if (t.entity_type === "individual") {
      grid.innerHTML = `
        <div class="detailItem"><span class="dlabel">유형</span><br/><span class="dvalue">개인</span></div>
        <div class="detailItem"><span class="dlabel">이름</span><br/><span class="dvalue">${t.name || "-"}</span></div>
        <div class="detailItem"><span class="dlabel">주민등록번호</span><br/><span class="dvalue" style="font-family:monospace;">${t.ssn_formatted || "-"}</span></div>
        <div class="detailItem"><span class="dlabel">등록일</span><br/><span class="dvalue">${fmtDate(t.created_at)}</span></div>
      `;
    } else {
      grid.innerHTML = `
        <div class="detailItem"><span class="dlabel">유형</span><br/><span class="dvalue">사업자</span></div>
        <div class="detailItem"><span class="dlabel">상호명</span><br/><span class="dvalue">${t.business_name || "-"}</span></div>
        <div class="detailItem"><span class="dlabel">사업자번호</span><br/><span class="dvalue" style="font-family:monospace;">${t.business_number_formatted || t.business_number || "-"}</span></div>
        <div class="detailItem"><span class="dlabel">등록일</span><br/><span class="dvalue">${fmtDate(t.created_at)}</span></div>
      `;
    }
    section.classList.remove("hidden");
  } catch (e) {
    if (e.message !== "AUTH") {
      section.classList.add("hidden");
      console.error("loadTaxInfo error:", e);
    }
  }
}

/* ──────────────────────────────────────
   DOM Ready: bind all events
────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  console.log("[admin.js] DOMContentLoaded - binding events");

  // Login Step 1: Password
  let tempToken = null;

  document.getElementById("btnLogin").addEventListener("click", async () => {
    const pw = document.getElementById("loginPw").value;
    const errEl = document.getElementById("loginErr");
    errEl.style.display = "none";
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.message || "Invalid password";
        errEl.style.display = "block";
        return;
      }

      if (data.requires_2fa) {
        tempToken = data.temp_token;
        document.getElementById("loginStep1").classList.add("hidden");

        if (data.setup_required) {
          // 최초 2FA 설정
          document.getElementById("qrCodeImg").src = data.qr_url;
          document.getElementById("manualSecret").textContent = data.secret_manual;
          document.getElementById("loginStep2Setup").classList.remove("hidden");
          document.getElementById("setupOtp").focus();
        } else {
          // 기존 2FA 검증
          document.getElementById("loginStep2Verify").classList.remove("hidden");
          document.getElementById("verifyOtp").focus();
        }
      } else {
        showAdmin();
        loadDashboard();
      }
    } catch {
      errEl.textContent = "Network error";
      errEl.style.display = "block";
    }
  });

  document.getElementById("loginPw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnLogin").click();
  });

  // Login Step 2a: 2FA Setup - Verify first OTP
  document.getElementById("btnSetupVerify").addEventListener("click", async () => {
    const otp = document.getElementById("setupOtp").value.trim();
    const errEl = document.getElementById("setupErr");
    errEl.style.display = "none";
    if (!otp || otp.length !== 6) {
      errEl.textContent = "6자리 코드를 입력해주세요.";
      errEl.style.display = "block";
      return;
    }
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp, temp_token: tempToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.message || "Verification failed";
        errEl.style.display = "block";
        return;
      }
      tempToken = null;
      showAdmin();
      loadDashboard();
    } catch {
      errEl.textContent = "Network error";
      errEl.style.display = "block";
    }
  });

  document.getElementById("setupOtp").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnSetupVerify").click();
  });

  // Login Step 2b: 2FA Verify (existing)
  document.getElementById("btnOtpVerify").addEventListener("click", async () => {
    const otp = document.getElementById("verifyOtp").value.trim();
    const errEl = document.getElementById("verifyErr");
    errEl.style.display = "none";
    if (!otp || otp.length !== 6) {
      errEl.textContent = "6자리 코드를 입력해주세요.";
      errEl.style.display = "block";
      return;
    }
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp, temp_token: tempToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.message || "Verification failed";
        errEl.style.display = "block";
        return;
      }
      tempToken = null;
      showAdmin();
      loadDashboard();
    } catch {
      errEl.textContent = "Network error";
      errEl.style.display = "block";
    }
  });

  document.getElementById("verifyOtp").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnOtpVerify").click();
  });

  // Logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
    showLogin();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tabContent").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "dashboard") loadDashboard();
      if (tab.dataset.tab === "transfers") loadTransfers();
    });
  });

  // Settlement toggle
  document.getElementById("settlementToggle").addEventListener("change", async (e) => {
    try {
      await apiFetch(`${API}/settings/settlement`, {
        method: "PUT",
        body: JSON.stringify({ enabled: e.target.checked }),
      });
      document.getElementById("settlementStatus").textContent = e.target.checked ? "ON" : "OFF";
    } catch (err) {
      if (err.message !== "AUTH") {
        e.target.checked = !e.target.checked;
        alert("Failed to update setting");
      }
    }
  });

  // Ambassador search
  document.getElementById("btnAmbSearch").addEventListener("click", () => {
    loadAmbassadors(document.getElementById("ambSearch").value.trim());
  });
  document.getElementById("ambSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnAmbSearch").click();
  });

  // Transfer pagination
  document.getElementById("transferPrev").addEventListener("click", () => { transferPage--; loadTransfers(); });
  document.getElementById("transferNext").addEventListener("click", () => { transferPage++; loadTransfers(); });

  // Transfer search
  document.getElementById("btnTransferSearch").addEventListener("click", () => {
    transferFilter = document.getElementById("transferSearch").value.trim() || null;
    transferPage = 0;
    loadTransfers();
  });
  document.getElementById("btnTransferClear").addEventListener("click", () => {
    document.getElementById("transferSearch").value = "";
    transferFilter = null;
    transferPage = 0;
    loadTransfers();
  });
  document.getElementById("transferSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnTransferSearch").click();
  });

  // Excel export
  const exportBtn = document.getElementById("btnExportExcel");
  console.log("[admin.js] exportBtn found:", !!exportBtn);
  if (exportBtn) {
    exportBtn.addEventListener("click", handleExportExcel);
    console.log("[admin.js] Excel export event bound");
  } else {
    console.error("[admin.js] btnExportExcel NOT FOUND in DOM");
  }

  // Points lookup
  document.getElementById("btnPointsLookup").addEventListener("click", async () => {
    const id = document.getElementById("pointsAmbId").value.trim();
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/ambassadors/${id}`);
      if (!res.ok) {
        document.getElementById("pointsDetail").classList.add("hidden");
        alert("Ambassador not found");
        return;
      }
      const data = await res.json();
      const a = data.ambassador;
      currentAmbId = a.id;

      document.getElementById("pdName").textContent = a.name || "-";
      document.getElementById("pdId").textContent = a.id;
      document.getElementById("pdEmail").textContent = a.email || "-";
      document.getElementById("pdPaypal").textContent = a.paypal_email || "-";
      document.getElementById("pdGrade").textContent = a.grade_name || "-";
      document.getElementById("pdCommission").textContent = a.commission_rate ? `${a.commission_rate}%` : "-";
      document.getElementById("pdReferral").textContent = a.referral_code || "-";
      document.getElementById("pdSettlementToggle").checked = a.settlement_enabled !== false;
      document.getElementById("pdCurrent").textContent = fmt(a.current_points) + " pts";
      document.getElementById("pdEarned").textContent = fmt(a.total_earned) + " pts";
      document.getElementById("pdWithdrawn").textContent = fmt(a.total_withdrawn) + " pts";

      document.getElementById("pointsDetail").classList.remove("hidden");
      loadTransactionHistory(a.id);
      loadTaxInfo(a.id);
    } catch (e) {
      if (e.message !== "AUTH") {
        console.error("lookup error:", e);
        alert("Error looking up ambassador");
      }
    }
  });
  document.getElementById("pointsAmbId").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnPointsLookup").click();
  });

  // Per-ambassador settlement toggle (Points tab detail)
  document.getElementById("pdSettlementToggle").addEventListener("change", async (e) => {
    if (!currentAmbId) return;
    try {
      await apiFetch(`${API}/ambassadors/${currentAmbId}/settlement`, {
        method: "PUT",
        body: JSON.stringify({ enabled: e.target.checked }),
      });
    } catch (err) {
      if (err.message !== "AUTH") {
        e.target.checked = !e.target.checked;
        alert("Failed to update settlement status");
      }
    }
  });

  // Point adjustment
  document.getElementById("btnAdjust").addEventListener("click", async () => {
    if (!currentAmbId) return alert("Lookup an ambassador first");

    const type = document.getElementById("adjustType").value;
    const rawAmount = parseFloat(document.getElementById("adjustAmount").value);
    const description = document.getElementById("adjustDesc").value.trim();
    const msgEl = document.getElementById("adjustMsg");
    msgEl.classList.add("hidden");

    if (!rawAmount || rawAmount <= 0) return alert("Enter a valid amount");

    const amount = type === "deduct" ? -rawAmount : rawAmount;
    const confirmMsg = type === "deduct"
      ? `Deduct ${fmt(rawAmount)} pts from Ambassador #${currentAmbId}?`
      : `Add ${fmt(rawAmount)} pts to Ambassador #${currentAmbId}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await apiFetch(`${API}/points/adjust`, {
        method: "POST",
        body: JSON.stringify({ ambassador_id: currentAmbId, amount, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.message || "Failed";
        msgEl.className = "adjustMsg error";
        msgEl.classList.remove("hidden");
        return;
      }

      msgEl.textContent = `Done: ${fmt(data.result.previous)} -> ${fmt(data.result.newBalance)} pts`;
      msgEl.className = "adjustMsg success";
      msgEl.classList.remove("hidden");

      document.getElementById("adjustAmount").value = "";
      document.getElementById("adjustDesc").value = "";
      document.getElementById("btnPointsLookup").click();
    } catch (e) {
      if (e.message !== "AUTH") {
        msgEl.textContent = "Network error";
        msgEl.className = "adjustMsg error";
        msgEl.classList.remove("hidden");
      }
    }
  });

  // Auto-login check
  (async () => {
    try {
      const res = await fetch(`${API}/settings`, { credentials: "include" });
      if (res.ok) {
        showAdmin();
        loadDashboard();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  })();

  console.log("[admin.js] all events bound successfully");
});
