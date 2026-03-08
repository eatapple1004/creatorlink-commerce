import * as service from "./admin.service.js";

export async function getSettings(req, res) {
  try {
    const settings = await service.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error("admin getSettings error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function toggleSettlement(req, res) {
  try {
    const { enabled } = req.body;
    const result = await service.toggleSettlement(!!enabled);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("admin toggleSettlement error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await service.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error("admin getStats error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function listAmbassadors(req, res) {
  try {
    const query = req.query.q || null;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);
    const items = await service.searchAmbassadors(query, limit, offset);
    res.json({ success: true, items });
  } catch (err) {
    console.error("admin listAmbassadors error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getAmbassador(req, res) {
  try {
    const id = Number(req.params.id);
    const ambassador = await service.getAmbassadorDetail(id);
    res.json({ success: true, ambassador });
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    console.error("admin getAmbassador error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getTransfers(req, res) {
  try {
    const ambassadorId = req.query.ambassador_id ? Number(req.query.ambassador_id) : null;
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const result = await service.getTransfers({ ambassadorId, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("admin getTransfers error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getTransactions(req, res) {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const items = await service.getTransactions({ ambassadorId: id, limit, offset });
    res.json({ success: true, items });
  } catch (err) {
    console.error("admin getTransactions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function adjustPoints(req, res) {
  try {
    const { ambassador_id, amount, description } = req.body;
    if (!ambassador_id || !amount) {
      return res.status(400).json({ message: "ambassador_id and amount are required" });
    }
    const result = await service.adjustPoints({
      ambassadorId: Number(ambassador_id),
      amount: parseFloat(amount),
      description,
    });
    res.json({ success: true, result });
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    if (err.message === "INVALID_INPUT") {
      return res.status(400).json({ message: "Invalid input" });
    }
    console.error("admin adjustPoints error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}
