// controllers/shopifyOAuth.controller.js
//
// Shopify OAuth 설치 플로우 — 스토어에 앱을 설치하고 offline Admin API 토큰을 발급받는다.
// 새 Dev Dashboard 앱은 레거시 커스텀 앱처럼 토큰을 바로 주지 않으므로,
// 표준 OAuth(authorization code grant)로 만료 없는 offline access token 을 획득한다.
//
// 사용:
//   1) 브라우저에서 GET /api/shopify/oauth/install?shop=<myshopify도메인>
//   2) Shopify 승인 화면에서 설치 승인
//   3) /callback 으로 리다이렉트 → code 를 access_token 으로 교환
//   4) 발급된 토큰을 화면/로그로 확인 → .env 의 SHOPIFY_<STORE>_ADMIN_ACCESS_TOKEN 에 저장
//
// 보안:
//   - state nonce (쿠키) 로 CSRF 방지
//   - 콜백 쿼리 HMAC 을 client secret 으로 검증
//   - shop 파라미터는 *.myshopify.com 형식만 허용 (open redirect 방지)

import crypto from "crypto";
import logger from "../config/logger.js";
import {
  getStoreByDomain,
  OAUTH_SCOPES,
  OAUTH_REDIRECT_BASE,
} from "../config/shopifyStores.js";

const SHOP_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const STATE_COOKIE = "shopify_oauth_state";

const redirectUri = () => `${OAUTH_REDIRECT_BASE}/api/shopify/oauth/callback`;

/**
 * 1단계: 설치 시작 → Shopify 승인 화면으로 리다이렉트
 */
export const install = (req, res) => {
  const shop = String(req.query.shop || "").toLowerCase();

  if (!SHOP_REGEX.test(shop)) {
    return res.status(400).send("invalid shop (expected <name>.myshopify.com)");
  }

  const store = getStoreByDomain(shop);
  if (!store) {
    return res.status(404).send(`unregistered shop: ${shop}`);
  }
  if (!store.clientId || !store.clientSecret) {
    return res
      .status(500)
      .send(`store '${store.key}' OAuth 자격증명(clientId/clientSecret) 미설정`);
  }

  // CSRF 방지용 state nonce
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10분
  });

  const authorizeUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(store.clientId)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&state=${state}` +
    `&grant_options[]=`; // 빈 값 = offline 토큰(만료 없음)

  logger.info(`🔑 [Shopify OAuth] install 시작 → shop=${shop}, store=${store.key}`);
  return res.redirect(authorizeUrl);
};

/**
 * 콜백 쿼리 HMAC 검증 (hmac 제외 파라미터 정렬 후 client secret 으로 서명)
 */
const verifyCallbackHmac = (query, clientSecret) => {
  const { hmac, signature, ...rest } = query;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(",") : rest[k]}`)
    .join("&");
  const digest = crypto
    .createHmac("sha256", clientSecret)
    .update(message)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(hmac || "")));
  } catch {
    return false;
  }
};

/**
 * 2단계: 콜백 → code 를 offline access_token 으로 교환
 */
export const callback = async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    const shopLc = String(shop || "").toLowerCase();

    if (!SHOP_REGEX.test(shopLc)) {
      return res.status(400).send("invalid shop");
    }

    const store = getStoreByDomain(shopLc);
    if (!store || !store.clientSecret) {
      return res.status(404).send(`unregistered shop: ${shopLc}`);
    }

    // state 검증
    const cookieState = req.cookies?.[STATE_COOKIE];
    if (!state || !cookieState || state !== cookieState) {
      return res.status(403).send("state mismatch (CSRF 방지)");
    }

    // HMAC 검증
    if (!verifyCallbackHmac(req.query, store.clientSecret)) {
      return res.status(401).send("hmac verification failed");
    }

    // code → access_token 교환
    const tokenRes = await fetch(`https://${shopLc}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: store.clientId,
        client_secret: store.clientSecret,
        code,
      }),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.access_token) {
      logger.error(`🟥 [Shopify OAuth] 토큰 교환 실패 → ${JSON.stringify(data)}`);
      return res.status(502).send(`token exchange failed: ${JSON.stringify(data)}`);
    }

    const token = data.access_token;
    const envKey = `SHOPIFY_${store.key.toUpperCase()}_ADMIN_ACCESS_TOKEN`;

    res.clearCookie(STATE_COOKIE);
    logger.info(`✅ [Shopify OAuth] 설치 완료 → shop=${shopLc}, store=${store.key}, scope=${data.scope}`);
    // 토큰은 로그에 전체를 남기지 않음(민감). 화면에만 1회 표시.
    logger.info(`✅ [Shopify OAuth] ${envKey} 발급됨 (앞 12자: ${token.slice(0, 12)}…)`);

    // 발급 토큰을 화면에 1회 표시 → 사용자가 .env 에 저장
    res.set("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>Shopify 설치 완료</title>
<style>body{font-family:-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.6}
code,pre{background:#f4f4f5;padding:2px 6px;border-radius:6px}
pre{padding:14px;overflow:auto;border:1px solid #e4e4e7}
.warn{color:#b91c1c}</style></head>
<body>
<h2>✅ ${store.key.toUpperCase()} 스토어 설치 완료</h2>
<p>shop: <code>${shopLc}</code><br>scope: <code>${data.scope}</code></p>
<p>아래 토큰을 <code>.env</code> 의 <code>${envKey}</code> 에 저장하세요. (offline 토큰 — 만료 없음)</p>
<pre>${envKey}=${token}</pre>
<p class="warn">⚠️ 이 토큰은 비밀입니다. 이 페이지를 닫으면 다시 표시되지 않아요. 저장 후 서버 재시작 필요.</p>
</body></html>`);
  } catch (err) {
    logger.error("🟥 [Shopify OAuth] callback 오류: " + err.stack);
    return res.status(500).send("server error");
  }
};
