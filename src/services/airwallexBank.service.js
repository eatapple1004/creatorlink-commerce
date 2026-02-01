import axios from 'axios';
import { getAirwallexAccessToken, getAirwallexBaseUrl } from './airwallexAuth.service.js';
import * as repo from '../repositories/airwallexBank.repo.js';

// 캐시 TTL(초) - 운영은 1일 권장
const TTL_SECONDS = 24 * 60 * 60;

export async function getSupportedBanks({ countryCode, transferMethod, currency }) {
  // 1) 캐시 조회
  const cached = await repo.findCachedBanks({ countryCode, transferMethod, currency, ttlSeconds: TTL_SECONDS });
  if (cached) return cached;

  // 2) Airwallex 호출 (지원 금융기관 조회)
  const token = await getAirwallexAccessToken();
  const baseUrl = getAirwallexBaseUrl();

  // ⚠️ Airwallex docs의 "Retrieve supported beneficiary banks" (지원 은행 조회) 페이지에 나온 엔드포인트를 사용해야 합니다. :contentReference[oaicite:2]{index=2}
  // 아래 urlPath는 문서에 맞춰 실제 값으로 세팅하세요. (프로젝트에선 여기 상수로 분리 권장)
  const url = `${baseUrl}/api/v1/beneficiaries/supported_banks`; // <- 문서 기준으로 교체 필요 가능

  const resp = await axios.get(url, {
    params: {
      country_code: countryCode,
      transfer_method: transferMethod,
      currency,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 20000,
  });

  const banks = normalizeBanks(resp.data);

  // 3) 캐시 저장
  await repo.upsertCachedBanks({ countryCode, transferMethod, currency, banks });

  return banks;
}

// Airwallex 응답 구조가 변동될 수 있어 normalize로 UI 친화적으로 고정
function normalizeBanks(data) {
  const arr = Array.isArray(data) ? data : (data?.items ?? data?.banks ?? []);
  return arr.map((x) => ({
    // UI 표시용
    name: x.name ?? x.bank_name ?? x.institution_name,
    // 저장/수취인등록용 키 (Airwallex가 bank_identifier를 주는 경우가 많음)
    bank_identifier: x.bank_identifier ?? x.identifier ?? null,
    // 한국은 3자리 bank_code가 필요할 수 있음(예: 003, 004). 이 값이 내려오면 그대로 씀.
    bank_code: x.bank_code ?? x.routing_value ?? null,
    // 추가 정보
    country_code: x.country_code ?? null,
  })).filter(b => b.name);
}
