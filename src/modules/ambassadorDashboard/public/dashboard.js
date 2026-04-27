const THRESHOLDS = {
  BRONZE:   0,
  SILVER:   20,
  GOLD:     50,
  PLATINUM: 200,
  DIAMOND:  500,
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

const state = {
  grade: "BRONZE",
  points: 0,
  sales: 0,
};

function formatNumber(n) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function setActiveTier() {
  document.querySelectorAll(".tier").forEach((el) => {
    el.classList.remove("active");
    if (el.dataset.tier.toUpperCase() === state.grade) {
      el.classList.add("active");
    }
  });
}

function calcProgressPercent() {
  // 전체 등급 구간에서의 절대 위치 계산
  // 각 등급 구간은 균등 분배 (5등급 = 각 25%)
  const segmentSize = 100 / (TIER_ORDER.length - 1); // 25%
  const idx = TIER_ORDER.indexOf(state.grade);

  // 최고 등급이면 100%
  if (idx === TIER_ORDER.length - 1) return 100;

  const min = THRESHOLDS[TIER_ORDER[idx]] ?? 0;
  const max = THRESHOLDS[TIER_ORDER[idx + 1]];
  // 관리자 강제 부여 시 건수가 기준 미달이면 등급 시작점 사용
  const sales = Math.max(state.sales, min);
  const withinSegment = Math.max(0, Math.min(1, (sales - min) / (max - min)));

  return (idx * segmentSize) + (withinSegment * segmentSize);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function render() {
  document.getElementById("gradeLabel").textContent = `${state.grade} AMBASSADOR`;
  document.getElementById("salesValue").textContent = formatNumber(state.sales);

  // 관리자 등급 부여 안내
  const lockEl = document.getElementById("gradeLockInfo");
  if (lockEl) {
    if (state.gradeLockedUntil && new Date(state.gradeLockedUntil) > new Date()) {
      lockEl.textContent = `관리자 등급 부여 (${formatDate(state.gradeLockedUntil)}까지 유지)`;
      lockEl.style.display = "block";
    } else {
      lockEl.style.display = "none";
    }
  }

  setActiveTier();

  const percent = calcProgressPercent();
  document.getElementById("barFill").style.width = `${percent}%`;
  document.getElementById("barKnob").style.left = `${percent}%`;
}

function showAuthError(msg) {
  const el = document.getElementById("salesValue");
  if (el) el.textContent = "-";
  const grade = document.getElementById("gradeLabel");
  if (grade) grade.textContent = msg;
}

function getToken() {
  // 1순위: URL ?token= 파라미터 (Shopify 로그인 후 리다이렉트 시 전달)
  const q = new URLSearchParams(location.search);
  const urlToken = q.get("token");
  console.log("[DEBUG] URL token:", urlToken ? urlToken.slice(0, 20) + "..." : "없음");

  if (urlToken) {
    localStorage.setItem("ambassador_token", urlToken);
    history.replaceState(null, "", location.pathname);
    return urlToken;
  }

  // 2순위: localStorage (새로고침 시)
  const lsToken = localStorage.getItem("ambassador_token");
  console.log("[DEBUG] localStorage token:", lsToken ? lsToken.slice(0, 20) + "..." : "없음");
  return lsToken;
}

async function loadDashboard() {
  const token = getToken();
  console.log("[DEBUG] 최종 사용 token:", token ? "있음 (" + token.slice(0, 20) + "...)" : "없음");

  if (!token) {
    showAuthError("로그인이 필요합니다");
    return;
  }

  try {
    console.log("[DEBUG] API 호출 시작");
    const res = await fetch("https://api.adamthefirstsin.com/iframe/ambassador/api/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    console.log("[DEBUG] API 응답 status:", res.status);

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("ambassador_token");
      fetch("https://api.adamthefirstsin.com/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      showAuthError("세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }

    if (!res.ok) throw new Error("서버 오류");

    const data = await res.json();

    state.grade  = data.grade_name || "BRONZE";
    state.points = parseFloat(data.current_points) || 0;
    state.sales  = parseInt(data.sales_last_60days, 10) || 0;
    state.gradeLockedUntil = data.grade_locked_until || null;

    // 추천코드 표시
    if (data.referral_code) {
      document.getElementById("referralCode").textContent = data.referral_code;
      document.getElementById("referralWrap").style.display = "inline-flex";
    }

    render();
  } catch (err) {
    console.error("대시보드 로드 실패:", err);
    showAuthError("데이터를 불러오지 못했습니다.");
  }
}

document.getElementById("btnWithdraw")?.addEventListener("click", (e) => {
  e.preventDefault();
  const token = localStorage.getItem("ambassador_token");
  const url = "https://api.adamthefirstsin.com/iframe/ambassador/settlement" +
    (token ? "?token=" + encodeURIComponent(token) : "");
  window.location.href = url;
});

document.getElementById("btnCopyCode")?.addEventListener("click", async () => {
  const btn = document.getElementById("btnCopyCode");
  const code = document.getElementById("referralCode").textContent.trim();
  if (!code || code === "-") {
    alert("복사할 추천인 코드가 없습니다.");
    return;
  }

  const showCopied = () => {
    btn.textContent = "복사됨!";
    setTimeout(() => { btn.textContent = "복사"; }, 1500);
  };

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code);
      showCopied();
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) showCopied();
    else alert("복사에 실패했습니다. 코드를 직접 복사해주세요: " + code);
  } catch (err) {
    alert("복사에 실패했습니다. 코드를 직접 복사해주세요: " + code);
  }
});

document.getElementById("btnLogout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await fetch("https://api.adamthefirstsin.com/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (_) {}
  localStorage.removeItem("ambassador_token");
  window.top.location.href = "https://kr.adamthefirstsin.com/pages/ambassador-login?logout=1";
});

// ── 구매 내역 ──

let ordersPage = 1;
const ORDERS_LIMIT = 20;

function formatOrderDate(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function getProductNames(lineItems) {
  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) return "-";
  return lineItems.map((item) => {
    const name = item.name || "-";
    return item.quantity > 1 ? `${name} x${item.quantity}` : name;
  }).join(", ");
}

function renderOrders(data) {
  const tbody = document.getElementById("ordersBody");
  if (!data.orders || data.orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="ordersEmpty">구매 내역이 없습니다.</td></tr>';
    document.getElementById("ordersPaging").innerHTML = "";
    return;
  }

  tbody.innerHTML = data.orders.map((o) => `
    <tr>
      <td class="productName">${getProductNames(o.line_items)}</td>
      <td class="pointsCell">+${formatNumber(Math.round(parseFloat(o.earned_points) || 0))}P</td>
      <td>${formatOrderDate(o.created_at)}</td>
    </tr>
  `).join("");

  // 페이지네이션
  const paging = document.getElementById("ordersPaging");
  if (data.totalPages <= 1) {
    paging.innerHTML = "";
    return;
  }

  let html = "";
  html += `<button class="pageBtn" ${data.page <= 1 ? "disabled" : ""} data-page="${data.page - 1}">&lt;</button>`;
  for (let i = 1; i <= data.totalPages; i++) {
    if (data.totalPages > 7 && Math.abs(i - data.page) > 2 && i !== 1 && i !== data.totalPages) {
      if (i === 2 || i === data.totalPages - 1) html += `<span style="font-size:11px;color:#999">...</span>`;
      continue;
    }
    html += `<button class="pageBtn${i === data.page ? " active" : ""}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="pageBtn" ${data.page >= data.totalPages ? "disabled" : ""} data-page="${data.page + 1}">&gt;</button>`;
  paging.innerHTML = html;

  paging.querySelectorAll(".pageBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p >= 1 && p <= data.totalPages) loadOrders(p);
    });
  });
}

async function loadOrders(page = 1) {
  const token = localStorage.getItem("ambassador_token");
  if (!token) return;

  try {
    const res = await fetch(
      `https://api.adamthefirstsin.com/iframe/ambassador/api/orders?page=${page}&limit=${ORDERS_LIMIT}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("주문 조회 실패");
    const data = await res.json();
    ordersPage = data.page;
    renderOrders(data);
  } catch (err) {
    console.error("주문 내역 로드 실패:", err);
    document.getElementById("ordersBody").innerHTML =
      '<tr><td colspan="5" class="ordersEmpty">데이터를 불러오지 못했습니다.</td></tr>';
  }
}

loadDashboard();
loadOrders();
