const THRESHOLDS = {
  BRONZE:   0,
  SILVER:   300000,
  GOLD:     600000,
  PLATINUM: 1000000,
  DIAMOND:  2000000,
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

const state = {
  grade: "BRONZE",
  points: 0,
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
  const idx = TIER_ORDER.indexOf(state.grade);
  const min = THRESHOLDS[TIER_ORDER[idx]] ?? 0;
  const nextTier = TIER_ORDER[idx + 1];
  // 최고 등급이면 100%
  if (!nextTier) return 100;
  const max = THRESHOLDS[nextTier];
  const p = Math.max(0, Math.min(1, (state.points - min) / (max - min)));
  return p * 100;
}

function render() {
  document.getElementById("gradeLabel").textContent = `${state.grade} AMBASSADOR`;
  document.getElementById("pointsValue").textContent = formatNumber(state.points);

  setActiveTier();

  const percent = calcProgressPercent();
  document.getElementById("barFill").style.width = `${percent}%`;
  document.getElementById("barKnob").style.left = `${percent}%`;
}

function showAuthError(msg) {
  const el = document.getElementById("pointsValue");
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
      showAuthError("세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }

    if (!res.ok) throw new Error("서버 오류");

    const data = await res.json();

    state.grade  = data.grade_name || "BRONZE";
    state.points = parseFloat(data.current_points) || 0;

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

loadDashboard();
