import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// ✅ public 정적 서빙
router.use("/ambassador-dashboard", express.static(publicDir));

// ✅ 페이지
router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(viewsDir, "dashboard.html"));
});

export default router;