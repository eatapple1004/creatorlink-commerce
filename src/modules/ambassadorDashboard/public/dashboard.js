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

async function loadDashboard() {
  // URL ?token= 파라미터가 있으면 Authorization 헤더로 사용 (fallback)
  const q = new URLSearchParams(location.search);
  const urlToken = q.get("token");
  if (urlToken) {
    history.replaceState(null, "", location.pathname);
  }

  const headers = urlToken
    ? { Authorization: `Bearer ${urlToken}` }
    : {};

  try {
    const res = await fetch("https://api.adamthefirstsin.com/iframe/ambassador/api/me", {
      headers,
      credentials: "include", // 쿠키 자동 전송
    });

    if (res.status === 401 || res.status === 403) {
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
  alert("정산 기능은 다음 단계에서 연결합니다.");
});

document.getElementById("btnCustomize")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("커스터마이징 기능은 다음 단계에서 연결합니다.");
});

loadDashboard();
