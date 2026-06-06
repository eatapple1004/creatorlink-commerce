// services/airwallexFx.service.js
//
// Airwallex 환율(FX) 조회 — 해외(USD) 주문 커미션을 KRW로 환산할 때 사용.
// 기존 Airwallex 인증(getAirwallexAccessToken)을 재사용한다.
//
// 특징:
// - 캐시(기본 30분): 환율은 초단위로 바뀔 필요 없음 + API 호출 절약
// - 폴백 환율(FX_USDKRW_FALLBACK, 기본 1350): API 실패 시 커미션 유실 방지
// - 응답 형태 방어적 파싱 + 합리적 범위(sanity) 검증
//
// 주의: Airwallex API는 서버 IP 화이트리스트라 로컬에선 403. 실제 응답 형태는
//       서버 로그(아래 logger.info 'raw=')로 확인할 것.

import axios from "axios";
import { getAirwallexAccessToken, getAirwallexBaseUrl } from "./airwallexAuth.service.js";
import logger from "../config/logger.js";

const FALLBACK_RATE = Number(process.env.FX_USDKRW_FALLBACK || 1350);
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분
const RATE_MIN = 800;   // sanity 하한 (이 밖이면 비정상으로 보고 폴백)
const RATE_MAX = 3000;  // sanity 상한

let cache = null; // { rate, atMs }

const inRange = (r) => Number.isFinite(r) && r >= RATE_MIN && r <= RATE_MAX;

/**
 * 1 USD = ? KRW (USD→KRW 환율)
 * - 실패/비정상 시 폴백 환율 반환 (절대 throw 하지 않음 → 적립 흐름 보호)
 */
export async function getUsdToKrwRate() {
  const now = Date.now();
  if (cache && now - cache.atMs < CACHE_TTL_MS) return cache.rate;

  try {
    const token = await getAirwallexAccessToken();
    const base = getAirwallexBaseUrl();
    // USD 를 팔아 KRW 를 사는 현재 시장환율
    const url = `${base}/api/v1/fx/rates/current?buy_currency=KRW&sell_currency=USD&sell_amount=1`;
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const d = r.data || {};

    // 응답 형태가 버전마다 다를 수 있어 방어적으로 해석
    let rate = Number(d.rate);
    if (!inRange(rate)) {
      // buy_amount(KRW) / sell_amount(USD) 로 역산
      const ba = Number(d.buy_amount);
      const sa = Number(d.sell_amount);
      if (Number.isFinite(ba) && Number.isFinite(sa) && sa > 0) rate = ba / sa;
    }

    if (!inRange(rate)) {
      logger.error(`🟥 [FX] 비정상 환율 응답 → 폴백 ${FALLBACK_RATE} 사용. raw=${JSON.stringify(d)}`);
      return FALLBACK_RATE;
    }

    cache = { rate, atMs: now };
    logger.info(`💱 [FX] USD→KRW = ${rate} (Airwallex)`);
    return rate;
  } catch (e) {
    logger.error(`🟥 [FX] Airwallex 환율 조회 실패 → 폴백 ${FALLBACK_RATE} 사용: ${e.response?.status || ""} ${e.message}`);
    return FALLBACK_RATE;
  }
}
