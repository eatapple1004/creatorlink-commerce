import path from "path";
import { fileURLToPath } from "url";
import { getDashboardDataService } from "./ambassadorDashboard.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function renderDashboard(req, res) {
  const filePath = path.join(__dirname, "views", "dashboard.html");
  return res.sendFile(filePath);
}

export async function getMe(req, res) {
  try {
    const data = await getDashboardDataService(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "앰버서더 정보를 찾을 수 없습니다." });
    }
    console.error("❌ getMe error:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
}
