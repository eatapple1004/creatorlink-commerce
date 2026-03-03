const API_BASE = "https://api.adamthefirstsin.com/iframe/ambassador";

let state = {
  withdrawable_points: 0,
};

function fmt(n) {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(n));
}

function formatDate(iso) {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

function statusLabel(s) {
  const up = (s || "").toUpperCase();
  if (up === "COMPLETED") return { text: "정산 완료", cls: "done" };
  if (["CREATED", "INITIATED", "PENDING", "PROCESSING"].includes(up))
    return { text: "진행 중", cls: "pending" };
  if (["FAILED", "CANCELLED"].includes(up))
    return { text: "실패", cls: "failed" };
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

function renderPoints(data) {
  state.withdrawable_points = data.withdrawable_points ?? 0;

  document.getElementById("currentPoints").textContent =
    fmt(data.current_points) + "points";
  document.getElementById("withdrawablePoints").textContent =
    fmt(data.withdrawable_points) + "points";
  document.getElementById("lockedPoints").textContent =
    fmt(data.locked_points) + "points";
}

function renderBankAccount(bank) {
  if (!bank) {
    document.getElementById("bankAccountName").textContent = "계좌 정보 없음";
    document.getElementById("bankInstitute").textContent = "";
    document.getElementById("bankNumber").textContent = "";
    return;
  }
  document.getElementById("bankAccountName").textContent =
    bank.account_name || "-";
  document.getElementById("bankInstitute").textContent =
    bank.routing_value1 || bank.routing_type1 || "-";
  document.getElementById("bankNumber").textContent =
    bank.account_number_masked || "-";
}

function renderPending(pending) {
  const container = document.getElementById("pendingList");
  if (!pending || pending.length === 0) {
    container.innerHTML = `<p class="emptyMsg">대기 중인 정산 내역이 없습니다.</p>`;
    return;
  }
  container.innerHTML = pending
    .map(
      (item) => `
    <div class="pendingItem">
      <span class="pendingDate">${formatDate(item.created_at)}</span>
      <span class="pendingAmt">${fmt(item.transfer_amount)}pts</span>
    </div>
  `
    )
    .join("");
}

function renderHistory(history) {
  const tbody = document.getElementById("historyBody");
  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="emptyMsg">요청 내역이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = history
    .map((item) => {
      const { text, cls } = statusLabel(item.status);
      return `
      <tr>
        <td>${formatDate(item.created_at)}</td>
        <td>${fmt(item.transfer_amount)}pts</td>
        <td><span class="statusChip ${cls}">${text}</span></td>
        <td><button class="iconBtn" title="상세">🔍</button></td>
      </tr>
    `;
    })
    .join("");
}

async function loadSettlement() {
  const token = getToken();
  if (!token) {
    showError("로그인이 필요합니다.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/settlement`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("ambassador_token");
      showError("세션이 만료되었습니다. 다시 로그인해주세요.");
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
    showError("데이터를 불러오지 못했습니다.");
  }
}

function showError(msg) {
  document.getElementById("currentPoints").textContent = "-";
  document.getElementById("withdrawablePoints").textContent = "-";
  document.getElementById("lockedPoints").textContent = msg;
}

/* ── 모달 ── */
const modal   = document.getElementById("settleModal");
const errEl   = document.getElementById("modalError");
const amtInput = document.getElementById("settleAmount");

document.getElementById("btnSettle").addEventListener("click", () => {
  document.getElementById("modalWithdrawable").textContent =
    fmt(state.withdrawable_points);
  amtInput.value = "";
  errEl.textContent = "";
  errEl.classList.add("hidden");
  modal.classList.remove("hidden");
});

document.getElementById("btnModalCancel").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("btnModalConfirm").addEventListener("click", async () => {
  const amount = parseFloat(amtInput.value);
  if (!amount || amount <= 0) {
    showModalError("금액을 입력해주세요.");
    return;
  }
  if (amount > state.withdrawable_points) {
    showModalError(
      `출금 가능 포인트(${fmt(state.withdrawable_points)}pts)를 초과합니다.`
    );
    return;
  }

  const btn = document.getElementById("btnModalConfirm");
  btn.disabled = true;
  btn.textContent = "처리 중...";

  const token = getToken();
  try {
    const res = await fetch(
      "https://api.adamthefirstsin.com/api/withdraw",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ amount }),
      }
    );

    const body = await res.json();
    if (!res.ok) {
      showModalError(body.message || "출금 요청에 실패했습니다.");
      return;
    }

    modal.classList.add("hidden");
    alert(`정산 요청이 완료되었습니다.`);
    loadSettlement(); // 데이터 새로고침
  } catch (err) {
    showModalError("네트워크 오류가 발생했습니다.");
  } finally {
    btn.disabled = false;
    btn.textContent = "확인";
  }
});

function showModalError(msg) {
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

loadSettlement();
