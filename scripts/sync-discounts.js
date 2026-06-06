// scripts/sync-discounts.js
//
// 모든 엠버서더의 Shopify 할인 코드를 활성화된 전체 스토어에 동기화한다.
// - 각 스토어에 동일한 referral 코드가 존재하도록 보장 (없으면 생성)
// - 각 스토어의 할인율을 현재 등급(ambassador_grade.discount_rate)으로 일치
//
// 멱등(재실행 안전): 이미 있으면 할인율만 맞추고, 없으면 생성.
//
// 실행 전 필수:
//   .env 에 SHOPIFY_GLOBAL_* (도메인/시크릿/Admin 토큰)가 채워져 있어야
//   GLOBAL 스토어에 코드가 생성됨. (없으면 GLOBAL 단계는 401로 스킵)
//
// 실행:
//   node scripts/sync-discounts.js
//   node scripts/sync-discounts.js 123      # 특정 ambassador_id 1명만

import pool from "../src/config/db.js";
import { getAllStores } from "../src/config/shopifyStores.js";
import { syncAmbassadorDiscount } from "../src/services/shopifyDiscount.service.js";

// Shopify API rate limit 완충용 딜레이(ms)
const DELAY_MS = 600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const onlyId = process.argv[2] ? Number(process.argv[2]) : null;

  const stores = getAllStores();
  console.log(`🏬 활성 스토어: ${stores.map((s) => `${s.key}(${s.domain})`).join(", ") || "없음"}`);
  if (stores.length < 2) {
    console.warn("⚠️  활성 스토어가 2개 미만입니다. GLOBAL .env 설정을 확인하세요. (동기화 효과 없음)");
  }

  // referral_code 가 있는 엠버서더 + 현재 등급 할인율 (등급 없으면 기본 10%)
  const { rows } = await pool.query(
    `SELECT ap.id,
            ap.referral_code,
            COALESCE(g.discount_rate, 10) AS discount_rate
     FROM ambassador_profile ap
     LEFT JOIN ambassador_grade g ON g.id = ap.grade_id
     WHERE ap.referral_code IS NOT NULL
       ${onlyId ? "AND ap.id = $1" : ""}
     ORDER BY ap.id ASC`,
    onlyId ? [onlyId] : []
  );

  console.log(`👥 대상 엠버서더: ${rows.length}명`);

  let ok = 0;
  let fail = 0;

  for (const amb of rows) {
    const rate = Number(amb.discount_rate);
    const results = await syncAmbassadorDiscount({
      ambassadorId: amb.id,
      referralCode: amb.referral_code,
      discountRate: rate,
    });

    const failed = results.filter((r) => !r.synced);
    if (failed.length === 0) {
      ok++;
    } else {
      fail++;
      console.warn(`  ⚠️ id=${amb.id} code=${amb.referral_code} 일부 실패: ${failed.map((f) => `${f.store}(${f.error})`).join(", ")}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✅ 완료 — 성공 ${ok}명 / 일부실패 ${fail}명 / 총 ${rows.length}명`);
}

run()
  .catch((err) => {
    console.error("❌ 스크립트 오류:", err);
  })
  .finally(() => process.exit(0));
