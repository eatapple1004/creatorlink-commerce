import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRouter     from "./src/routes/auth.route.js";
import rewardRouter   from "./src/routes/reward.route.js";
import payoutRouter   from "./src/routes/payout.route.js"
import pointsRouter   from "./src/routes/points.route.js"
import withdrawRouter from "./src/routes/withdraw.route.js";
import paypalWebhook  from "./src/routes/paypalWebhook.route.js";
import shopifyWebhook from "./src/routes/shopifyWebhook.routes.js";

import airwallex                  from "./src/routes/airwallex.route.js";
import airwallexBeneficiaryRoutes from "./src/routes/airwallexBeneficiary.routes.js";
import airwallexTransferRoutes    from './src/routes/airwallexTransfer.routes.js';
import airwallexWebhookRoutes     from './src/routes/airwallexWebhook.routes.js';

import ambassadorDashboardRoutes  from "./src/modules/ambassadorDashboard/ambassadorDashboard.routes.js";
import pointsSettlementRoutes     from "./src/modules/pointsSettlement/pointsSettlement.routes.js";
import adminRoutes                from "./src/modules/admin/admin.routes.js";


import pool from "./src/config/db.js";   // ✅ import로 변경

dotenv.config();
const app = express();

const allowedOrigins = [
    "https://adamthefirstsin.com",      // Shopify 실제 스토어 도메인
    "https://kr.adamthefirstsin.com",   // Shopify 한국 스토어 도메인
    "https://www.adamthefirstsin.com",  // www 버전
    "https://api.adamthefirstsin.com",  // API 서버 자체 도메인 (대시보드 iframe)
    "http://localhost:8080"             // 로컬 테스트용
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        } else {
        callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
    "/iframe/ambassador/static",
    express.static(path.join(__dirname, "src/modules/ambassadorDashboard/public"))
);

app.use(cookieParser());
app.use("/api/shopify/webhook",  express.raw({ type: "*/*" }));
app.use("/api/airwallex/webhook", express.raw({ type: "*/*" }));

app.use(express.json());
app.use("/api/auth",            authRouter);
app.use("/api/rewards",         rewardRouter);
app.use("/api/payout",          payoutRouter);
app.use("/api/points",          pointsRouter);
app.use("/api/withdraw",        withdrawRouter);
app.use("/api/paypal",          paypalWebhook);
app.use("/api/shopify/webhook", shopifyWebhook);

app.use("/api/airwallex", airwallex);
app.use("/api/airwallex", airwallexBeneficiaryRoutes);
app.use('/api/airwallex', airwallexTransferRoutes);
app.use('/api/airwallex', airwallexWebhookRoutes);

app.use("/iframe/ambassador", ambassadorDashboardRoutes);
app.use("/iframe/ambassador", pointsSettlementRoutes);

app.use("/admin", adminRoutes);

app.listen(process.env.PORT || 8080, () => {
    console.log(`✅ Server running on port ${process.env.PORT}`);
});

app.get("/", (req, res) => {
    // Shopify Admin에서 앱 로드 시 → 토큰 캡처 페이지
    if (req.query.shop || req.query.host) {
      return res.send(`<!DOCTYPE html>
<html><head>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head><body>
  <h2>Shopify Token Exchange...</h2>
  <pre id="result">처리 중...</pre>
  <script>
    (async () => {
      try {
        const idToken = await shopify.idToken();
        document.getElementById("result").textContent = "id_token 획득 완료. 교환 중...";
        const res = await fetch("/api/shopify/token-exchange?id_token=" + encodeURIComponent(idToken));
        const text = await res.text();
        document.getElementById("result").innerHTML = text;
      } catch (e) {
        document.getElementById("result").textContent = "에러: " + e.message;
      }
    })();
  </script>
</body></html>`);
    }
    res.send("Creatorlink Commerce Server is running successfully!");
});

// ── 임시 Shopify 토큰 교환 (embedded app용, 발급 후 삭제) ──
app.get("/api/shopify/oauth/callback", async (req, res) => {
  console.log("🔑 [Shopify OAuth] callback query:", req.query);
  res.send("OK - query: " + JSON.stringify(req.query));
});

app.get("/api/shopify/token-exchange", async (req, res) => {
  const idToken = req.query.id_token;
  if (!idToken) return res.status(400).send("Missing id_token param");

  try {
    const resp = await fetch("https://mmjnwe-fr.myshopify.com/admin/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: idToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:id-token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      }),
    });
    const text = await resp.text();
    console.log("🔑 [Shopify Token Exchange] status:", resp.status, "body:", text);
    res.send(`<h2>Token Exchange 결과</h2><p>Status: ${resp.status}</p><pre>${text}</pre>`);
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).send("실패: " + err.message);
  }
});
