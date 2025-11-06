import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRouter from "./src/routes/auth.route.js";
import rewardRouter from "./src/routes/reward.route.js";
import payoutRouter from "./src/routes/payout.route.js"
import pool from "./src/config/db.js";   // ✅ import로 변경

dotenv.config();
const app = express();

const allowedOrigins = [
    "https://adamthefirstsin.com",   // Shopify 실제 스토어 도메인
    "https://www.adamthefirstsin.com", // www 버전도 허용
    "http://localhost:8080"          // 로컬 테스트용 (선택사항)
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


app.use(express.json());
app.use("/api/auth",    authRouter);
app.use("/api/rewards", rewardRouter);
app.use("/api/payout",  payoutRouter);

app.listen(process.env.PORT || 8080, () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});

app.get("/", (req, res) => {
    res.send("🚀 Creatorlink Commerce Server is running successfully!");
});
