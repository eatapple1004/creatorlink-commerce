import axios from 'axios';

const {
  AIRWALLEX_BASE_URL,
  AIRWALLEX_CLIENT_ID,
  AIRWALLEX_API_KEY,
} = process.env;

if (!AIRWALLEX_BASE_URL || !AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
  throw new Error('Missing Airwallex env: AIRWALLEX_BASE_URL, AIRWALLEX_CLIENT_ID, AIRWALLEX_API_KEY');
}

const airwallexHttp = axios.create({
  baseURL: AIRWALLEX_BASE_URL,
  timeout: 15000,
});

// 캐시
let cachedToken = null;
let cachedExpiresAtRaw = null;     // "2026-01-28T17:13:55+0000"
let cachedExpiresAtMs = 0;         // 만료(또는 재발급 기준) 시각 ms
let inFlightPromise = null;

// "+0000" -> "+00:00" 보정 (Node Date.parse 안정화)
function normalizeExpiresAt(expiresAtRaw) {
  return String(expiresAtRaw).replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

async function requestNewToken() {
  const res = await airwallexHttp.post(
    '/api/v1/authentication/login',
    {},
    {
      headers: {
        'x-client-id': AIRWALLEX_CLIENT_ID,
        'x-api-key': AIRWALLEX_API_KEY,
      },
    }
  );

  const token = res.data?.token;
  const expiresAtRaw = res.data?.expires_at;

  if (!token) throw new Error(`Airwallex token missing: ${JSON.stringify(res.data)}`);
  if (!expiresAtRaw) throw new Error(`Airwallex expires_at missing: ${JSON.stringify(res.data)}`);

  const expiresAtIso = normalizeExpiresAt(expiresAtRaw);
  const expiresAtMs = Date.parse(expiresAtIso);

  if (Number.isNaN(expiresAtMs)) {
    throw new Error(`Airwallex expires_at parse failed: raw=${expiresAtRaw} iso=${expiresAtIso}`);
  }

  // 만료 10초 전부터는 재발급하도록 safety window
  const safetyMs = 10_000;

  cachedToken = token;
  cachedExpiresAtRaw = expiresAtRaw;
  cachedExpiresAtMs = expiresAtMs - safetyMs;

  return { token, expires_at: expiresAtRaw, expires_at_ms: expiresAtMs };
}

/**
 * 토큰만 필요하면 이거
 */
export async function getAirwallexToken() {
  const info = await getAirwallexTokenInfo();
  return info.token;
}

/**
 * 토큰+만료 정보 필요하면 이거 (컨트롤러에서 사용)
 */
export async function getAirwallexTokenInfo() {
  const now = Date.now();

  // 1) 유효 캐시
  if (cachedToken && now < cachedExpiresAtMs) {
    return {
      token: cachedToken,
      expires_at: cachedExpiresAtRaw,
      expires_at_ms: cachedExpiresAtMs,
    };
  }

  // 2) 동시성 방지
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = requestNewToken()
    .catch((err) => {
      // 실패 시 캐시를 깨끗하게
      cachedToken = null;
      cachedExpiresAtRaw = null;
      cachedExpiresAtMs = 0;
      throw err;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

/**
 * 다른 API 호출용 Authorization 헤더
 */
export async function getAirwallexAuthHeader() {
  const token = await getAirwallexToken();
  return { Authorization: `Bearer ${token}` };
}
