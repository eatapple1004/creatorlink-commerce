import { sendPayout } from "../services/payout.service.js";

export const payoutToAmbassador = async (req, res) => {
  try {
    const { email, amount } = req.body;
    const result = await sendPayout({ email, amount });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
