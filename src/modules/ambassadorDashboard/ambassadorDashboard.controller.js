import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function renderDashboard(req, res) {
    const filePath = path.join(__dirname, "views", "dashboard.html");
    return res.sendFile(filePath);
}