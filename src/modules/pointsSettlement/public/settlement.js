const API_BASE = "https://api.adamthefirstsin.com/iframe/ambassador";
const AIRWALLEX_BANKS_API = "https://api.adamthefirstsin.com/api/airwallex/banks?bank_country_code=KR&account_currency=KRW&entity_type=PERSONAL&transfer_method=LOCAL";

let state = {
  withdrawable_points: 0,
  token: null,
};

// 등록 폼 임시 데이터
const regData = {};

/* ─────────────────────────────────────
   유틸
───────────────────────────────────── */
function fmt(n) {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(n || 0));
}
function formatDate(iso) {
  return iso ? iso.slice(0, 10) : "-";
}
function statusLabel(s) {
  const up = (s || "").toUpperCase();
  if (up === "COMPLETED")   return { text: "정산 완료", cls: "done" };
  if (["CREATED","INITIATED","PENDING","PROCESSING"].includes(up))
                             return { text: "진행 중",  cls: "pending" };
  if (["FAILED","CANCELLED"].includes(up))
                             return { text: "실패",     cls: "failed" };
  return { text: s || "-", cls: "" };
}

function getToken() {
  const q = new URLSearchParams(location.search);
  const urlToken = q.get("token");
  if (urlToken) {
    localStorage.setItem("ambassador_token", urlToken);
    history.replaceState(null, "", location.pathname);
    return urlToken;
  }
  return localStorage.getItem("ambassador_token");
}

async function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
    credentials: "include",
  });
}

/* ─────────────────────────────────────
   렌더링
───────────────────────────────────── */
function renderPoints(data) {
  state.withdrawable_points = data.withdrawable_points ?? 0;
  document.getElementById("currentPoints").textContent      = fmt(data.current_points)      + "points";
  document.getElementById("withdrawablePoints").textContent = fmt(data.withdrawable_points) + "points";
  document.getElementById("lockedPoints").textContent       = fmt(data.locked_points)       + "points";
}

function renderBankAccount(bank) {
  const filled = document.getElementById("bankInfoFilled");
  const empty  = document.getElementById("bankInfoEmpty");
  if (!bank) {
    filled.style.display = "none";
    empty.style.display  = "block";
    return;
  }
  filled.style.display = "block";
  empty.style.display  = "none";
  document.getElementById("bankAccountName").textContent = bank.account_name || "-";
  document.getElementById("bankInstitute").textContent   = bank.routing_value1 || bank.routing_type1 || "-";
  document.getElementById("bankNumber").textContent      = bank.account_number_masked || "-";
}

function renderPending(pending) {
  const container = document.getElementById("pendingList");
  if (!pending || pending.length === 0) {
    container.innerHTML = `<p class="emptyMsg">대기 중인 정산 내역이 없습니다.</p>`;
    return;
  }
  container.innerHTML = pending.map((item) => `
    <div class="pendingItem">
      <span class="pendingDate">${formatDate(item.created_at)}</span>
      <span class="pendingAmt">${fmt(item.transfer_amount)}pts</span>
    </div>
  `).join("");
}

function renderHistory(history) {
  const tbody = document.getElementById("historyBody");
  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="emptyMsg">요청 내역이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = history.map((item) => {
    const { text, cls } = statusLabel(item.status);
    return `
      <tr>
        <td>${formatDate(item.created_at)}</td>
        <td>${fmt(item.transfer_amount)}pts</td>
        <td><span class="statusChip ${cls}">${text}</span></td>
        <td></td>
      </tr>
    `;
  }).join("");
}

/* ─────────────────────────────────────
   데이터 로드
───────────────────────────────────── */
async function loadSettlement() {
  state.token = getToken();
  if (!state.token) { showPageError("로그인이 필요합니다."); return; }

  try {
    const res  = await authFetch(`${API_BASE}/api/settlement`);
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("ambassador_token");
      showPageError("세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }
    if (!res.ok) throw new Error("서버 오류");
    const data = await res.json();
    renderPoints(data);
    renderBankAccount(data.bank_account);
    renderPending(data.pending);
    renderHistory(data.history);
  } catch (err) {
    console.error("정산 데이터 로드 실패:", err);
    showPageError("데이터를 불러오지 못했습니다.");
  }
}

function showPageError(msg) {
  document.getElementById("lockedPoints").textContent = msg;
  document.getElementById("currentPoints").textContent = "-";
  document.getElementById("withdrawablePoints").textContent = "-";
}

/* ─────────────────────────────────────
   모달 공통
───────────────────────────────────── */
const overlay = document.getElementById("modalOverlay");

function openModal(id) {
  overlay.classList.remove("hidden");
  ["modalRegister", "modalWithdraw"].forEach((m) => {
    document.getElementById(m).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}
function closeModal() {
  overlay.classList.add("hidden");
}

/* ─────────────────────────────────────
   [A] 계좌 등록 플로우
───────────────────────────────────── */
function setStep(n) {
  [1, 2, 3].forEach((i) => {
    document.getElementById(`si${i}`).className = "step" + (i < n ? " done" : i === n ? " active" : "");
    document.getElementById(`stepPanel${i}`).classList.toggle("hidden", i !== n);
  });
}

function showRegErr(step, msg) {
  const el = document.getElementById(`regErr${step}`);
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearRegErr(step) {
  const el = document.getElementById(`regErr${step}`);
  el.textContent = "";
  el.classList.add("hidden");
}

async function openRegisterFlow() {
  // 은행 목록 미리 로드
  loadBankList();
  setStep(1);
  document.getElementById("regName").value  = "";
  document.getElementById("regDob").value   = "";
  document.getElementById("regEmail").value = "";
  openModal("modalRegister");
}

async function loadBankList() {
  const select = document.getElementById("regBank");
  select.innerHTML = `<option value="">불러오는 중...</option>`;
  try {
    const res   = await fetch(AIRWALLEX_BANKS_API);
    const data  = await res.json();
    const banks = data.banks || [];
    if (banks.length === 0) {
      select.innerHTML = `<option value="">은행 목록을 불러오지 못했습니다.</option>`;
      return;
    }
    select.innerHTML = `<option value="">-- 은행 선택 --</option>` +
      banks.map((b) => `<option value="${b.bank_code}">${b.name}</option>`).join("");
  } catch {
    select.innerHTML = `<option value="">불러오기 실패</option>`;
  }
}

// Step 1 → 2
document.getElementById("btnStep1Next").addEventListener("click", () => {
  clearRegErr(1);
  const name  = document.getElementById("regName").value.trim();
  const dob   = document.getElementById("regDob").value.trim();
  const email = document.getElementById("regEmail").value.trim();

  if (!name)  return showRegErr(1, "예금주 실명을 입력해주세요.");
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return showRegErr(1, "생년월일을 YYYY-MM-DD 형식으로 입력해주세요.");
  if (!email) return showRegErr(1, "이메일을 입력해주세요.");

  regData.account_name = name;
  regData.date_of_birth = dob;
  regData.email = email;
  setStep(2);
});

// Step 2 → 3
document.getElementById("btnStep2Next").addEventListener("click", () => {
  clearRegErr(2);
  const bankCode = document.getElementById("regBank").value;
  const bankName = document.getElementById("regBank").selectedOptions[0]?.text || "";
  if (!bankCode) return showRegErr(2, "은행을 선택해주세요.");
  regData.bank_code = bankCode;
  regData.bank_name = bankName;
  setStep(3);
});

// Step 3 → 등록
document.getElementById("btnStep3Submit").addEventListener("click", async () => {
  clearRegErr(3);
  const accountNumber = document.getElementById("regAccount").value.trim().replace(/\D/g, "");
  if (!accountNumber) return showRegErr(3, "계좌번호를 입력해주세요.");

  regData.account_number = accountNumber;

  const btn = document.getElementById("btnStep3Submit");
  btn.disabled = true;
  btn.textContent = "등록 중...";

  try {
    const res  = await authFetch(`${API_BASE}/api/settlement/beneficiary`, {
      method: "POST",
      body: JSON.stringify(regData),
    });
    const body = await res.json();
    if (!res.ok) {
      showRegErr(3, body.message || "등록에 실패했습니다.");
      return;
    }
    closeModal();
    alert("계좌가 등록되었습니다.");
    loadSettlement();
  } catch {
    showRegErr(3, "네트워크 오류가 발생했습니다.");
  } finally {
    btn.disabled = false;
    btn.textContent = "등록하기";
  }
});

// 이전 버튼
document.getElementById("btnStep2Back").addEventListener("click", () => setStep(1));
document.getElementById("btnStep3Back").addEventListener("click", () => setStep(2));

// 취소 버튼
document.getElementById("btnRegCancel1").addEventListener("click", closeModal);

/* ─────────────────────────────────────
   [B] 출금 플로우
───────────────────────────────────── */
async function openWithdrawModal(bank) {
  document.getElementById("modalWithdrawable").textContent = fmt(state.withdrawable_points);
  document.getElementById("withdrawAmount").value = "";

  // 계좌 정보 표시
  const info = document.getElementById("withdrawAccountInfo");
  if (bank) {
    info.innerHTML = `
      <strong>${bank.account_name || ""}</strong> &nbsp;
      ${bank.routing_value1 || ""} &nbsp;
      ${bank.account_number_masked || ""}
    `;
    info.style.display = "block";
  } else {
    info.style.display = "none";
  }

  const errEl = document.getElementById("withdrawErr");
  errEl.textContent = "";
  errEl.classList.add("hidden");

  openModal("modalWithdraw");
}

document.getElementById("btnWithdrawCancel").addEventListener("click", closeModal);

document.getElementById("btnWithdrawConfirm").addEventListener("click", async () => {
  const errEl = document.getElementById("withdrawErr");
  errEl.classList.add("hidden");

  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (!amount || amount <= 0) {
    errEl.textContent = "금액을 입력해주세요.";
    errEl.classList.remove("hidden");
    return;
  }
  if (amount > state.withdrawable_points) {
    errEl.textContent = `출금 가능 포인트(${fmt(state.withdrawable_points)}pts)를 초과합니다.`;
    errEl.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("btnWithdrawConfirm");
  btn.disabled = true;
  btn.textContent = "처리 중...";

  try {
    const res  = await authFetch(`${API_BASE}/api/settlement/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    const body = await res.json();
    if (!res.ok) {
      errEl.textContent = body.message || "출금 요청에 실패했습니다.";
      errEl.classList.remove("hidden");
      return;
    }
    closeModal();
    alert(`정산 요청이 완료되었습니다.`);
    loadSettlement();
  } catch {
    errEl.textContent = "네트워크 오류가 발생했습니다.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "정산 요청";
  }
});

/* ─────────────────────────────────────
   정산 요청 버튼 클릭
   → beneficiary 체크 → 없으면 등록 / 있으면 출금
───────────────────────────────────── */
document.getElementById("btnSettle").addEventListener("click", async () => {
  if (!state.token) { alert("로그인이 필요합니다."); return; }

  const btn = document.getElementById("btnSettle");
  btn.disabled = true;
  btn.textContent = "확인 중...";

  try {
    const res  = await authFetch(`${API_BASE}/api/settlement/beneficiary`);
    const data = await res.json();

    if (data.exists) {
      // 계좌 있음 → 출금 모달
      const bank = document.getElementById("bankInfoFilled").style.display !== "none"
        ? {
            account_name:         document.getElementById("bankAccountName").textContent,
            routing_value1:       document.getElementById("bankInstitute").textContent,
            account_number_masked:document.getElementById("bankNumber").textContent,
          }
        : null;
      openWithdrawModal(bank);
    } else {
      // 계좌 없음 → 등록 플로우
      openRegisterFlow();
    }
  } catch {
    alert("요청 처리 중 오류가 발생했습니다.");
  } finally {
    btn.disabled = false;
    btn.textContent = "정산 요청";
  }
});

/* ─────────────────────────────────────
   대시보드 뒤로가기
───────────────────────────────────── */
document.getElementById("btnBackDashboard")?.addEventListener("click", (e) => {
  e.preventDefault();
  const token = localStorage.getItem("ambassador_token");
  const url = "https://api.adamthefirstsin.com/iframe/ambassador/dashboard" +
    (token ? "?token=" + encodeURIComponent(token) : "");
  window.location.href = url;
});

/* ─────────────────────────────────────
   초기화
───────────────────────────────────── */
loadSettlement();
