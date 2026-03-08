import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { adminAuth, loginAdmin } from "./admin.auth.js";
import * as ctrl from "./admin.controller.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// Static files (CSS, JS)
router.use("/static", express.static(publicDir));

// Admin page HTML
router.get("/", (req, res) => {
  res.sendFile(path.join(viewsDir, "admin.html"));
});

// Login (no auth required)
router.post("/api/login", loginAdmin);

// ── Protected API routes ──
router.get("/api/settings",            adminAuth, ctrl.getSettings);
router.put("/api/settings/settlement", adminAuth, ctrl.toggleSettlement);
router.get("/api/stats",               adminAuth, ctrl.getStats);
router.get("/api/ambassadors",         adminAuth, ctrl.listAmbassadors);
router.get("/api/ambassadors/:id",     adminAuth, ctrl.getAmbassador);
router.get("/api/ambassadors/:id/transactions", adminAuth, ctrl.getTransactions);
router.get("/api/transfers",           adminAuth, ctrl.getTransfers);
router.get("/api/transfers/export",    adminAuth, ctrl.exportTransfers);
router.post("/api/points/adjust",      adminAuth, ctrl.adjustPoints);

export default router;
