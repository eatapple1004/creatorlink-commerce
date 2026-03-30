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

function render() {
  document.getElementById("gradeLabel").textContent = `${state.grade} AMBASSADOR`;
  document.getElementById("salesValue").textContent = formatNumber(state.sales);

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

document.getElementById("btnCustomize")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("커스터마이징 기능은 다음 단계에서 연결합니다.");
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

loadDashboard();
