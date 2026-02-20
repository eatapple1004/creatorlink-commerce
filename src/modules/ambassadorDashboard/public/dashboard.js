const state = {
    grade: "BRONZE",
    points: 0,
    thresholds: {
      BRONZE: 0,
      SILVER: 300000,
      GOLD: 600000,
      PLATINUM: 1000000,
      DIAMOND: 2000000
    }
  };
  
  function formatNumber(n){
    return new Intl.NumberFormat("ko-KR").format(n);
  }
  
  function setActiveTier(){
    const map = {
      bronze: "BRONZE",
      silver: "SILVER",
      gold: "GOLD",
      platinum: "PLATINUM",
      diamond: "DIAMOND",
    };
  
    document.querySelectorAll(".tier").forEach(el => {
      el.classList.remove("active");
      if (map[el.dataset.tier] === state.grade) el.classList.add("active");
    });
  }
  
  function calcProgressPercent(){
    // 시안 느낌 우선: BRONZE->SILVER 구간 기준으로만 표시
    const min = state.thresholds.BRONZE;
    const max = state.thresholds.SILVER;
    const p = Math.max(0, Math.min(1, (state.points - min) / (max - min)));
    return p * 100;
  }
  
  function render(){
    const gradeLabel = document.getElementById("gradeLabel");
    const pointsValue = document.getElementById("pointsValue");
    const barFill = document.getElementById("barFill");
    const barKnob = document.getElementById("barKnob");
  
    gradeLabel.textContent = `${state.grade} AMBASSADOR`;
    pointsValue.textContent = formatNumber(state.points);
  
    setActiveTier();
  
    const percent = calcProgressPercent();
    barFill.style.width = `${percent}%`;
    barKnob.style.left = `${percent}%`;
  }
  
  document.getElementById("btnWithdraw")?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("정산 기능은 다음 단계에서 연결합니다.");
  });
  
  document.getElementById("btnCustomize")?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("커스터마이징 기능은 다음 단계에서 연결합니다.");
  });
  
  // 로컬 테스트용: /ambassador/dashboard?points=12500&grade=SILVER
  (function initFromQuery(){
    const q = new URLSearchParams(location.search);
    const grade = q.get("grade");
    const points = q.get("points");
  
    if (grade) state.grade = String(grade).toUpperCase();
    if (points) state.points = Number(points);
  
    render();
  })();