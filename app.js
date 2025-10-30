import express from "express";
import dotenv from "dotenv";
import authRouter from "./src/routes/auth.route.js";
import rewardRouter from "./src/routes/reward.route.js";
import payoutRouter from "./src/routes/payout.route.js"
import pool from "./src/config/db.js";   // ✅ import로 변경

dotenv.config();
const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/rewards", rewardRouter);
app.use("/api/payout", payoutRouter);

app.listen(process.env.PORT || 8080, () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});

app.get("/", (req, res) => {
    res.send("🚀 Creatorlink Commerce Server is running successfully!");
});
