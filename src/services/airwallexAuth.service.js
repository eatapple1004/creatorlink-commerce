import axios from 'axios';
import { env } from '../config/env.js';

function getBaseUrl() {
  return env.AIRWALLEX_ENV === 'prod'
    ? 'https://api.airwallex.com'
    : 'https://api-demo.airwallex.com';
}

let cachedToken = null; // { token, expiresAtMs }

export async function getAirwallexAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return cachedToken.token;
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v1/authentication/login`;

  try {
    const resp = await axios.post(
      url,
      {}, // ✅ body는 비워도 됨(헤더 인증)
      {
        headers: {
          'x-client-id': env.AIRWALLEX_CLIENT_ID,
          'x-api-key': env.AIRWALLEX_API_KEY,

          // (필요 시) 멀티 계정/온비하프 계정일 때만
          // 'x-login-as': env.AIRWALLEX_LOGIN_AS,
          // 'x-on-behalf-of': env.AIRWALLEX_ON_BEHALF_OF,
        },
        timeout: 15_000,
      }
    );

    const token = resp.data?.token;
    const expiresIn = Number(resp.data?.expires_in ?? 0);

    if (!token) throw new Error('Airwallex token missing in response');

    cachedToken = {
      token,
      expiresAtMs: now + Math.max(60, expiresIn || 3600) * 1000,
    };

    return token;
  } catch (e) {
    // ✅ 원인 파악을 위해 Airwallex 응답 바디를 로그로 꼭 확인
    console.error('[Airwallex][login] status=', e.response?.status);
    console.error('[Airwallex][login] data=', e.response?.data);
    throw e;
  }
}

export function getAirwallexBaseUrl() {
  return getBaseUrl();
}
