import { sendPayout } from "../services/payout.service.js";


/*
 * paypal payout controller
 * Cancled 
 * - reason : 페이팔이 한국에서 한국 송금 지원을 안함
 */
export const payoutToAmbassador = async (req, res) => {
  try {
    const { email, amount } = req.body;
    const result = await sendPayout({ email, amount });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

