import {
  getSettlementPageDataService,
  checkBeneficiaryService,
  registerBeneficiaryService,
  submitWithdrawalService,
} from "./pointsSettlement.service.js";

export async function getSettlementData(req, res) {
  try {
    const data = await getSettlementPageDataService(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.message === "POINTS_RECORD_NOT_FOUND") {
      return res.status(404).json({ message: "포인트 정보를 찾을 수 없습니다." });
    }
    console.error("❌ getSettlementData error:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
}

/**
 * 활성 수취인 계좌 확인
 * GET /iframe/ambassador/api/settlement/beneficiary
 */
export async function getBeneficiary(req, res) {
  try {
    const beneficiary = await checkBeneficiaryService(req.user.id);
    res.json({ exists: !!beneficiary, beneficiary: beneficiary || null });
  } catch (err) {
    console.error("❌ getBeneficiary error:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
}

/**
 * 수취인 계좌 등록
 * POST /iframe/ambassador/api/settlement/beneficiary
 * body: { account_name, account_number, bank_code, date_of_birth, email }
 */
export async function registerBeneficiary(req, res) {
  try {
    const { account_name, account_number, bank_code, date_of_birth, email,
            city, postcode, street_address } = req.body;

    if (!account_name || !account_number || !bank_code || !date_of_birth || !city || !postcode || !street_address) {
      return res.status(400).json({ message: "필수 항목이 누락되었습니다." });
    }

    const result = await registerBeneficiaryService(req.user.id, {
      account_name,
      account_number,
      bank_code,
      date_of_birth,
      email: email || req.user.email,
      city,
      postcode,
      street_address,
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ registerBeneficiary error:", err.message, err.detail);
    const status = err.status || 500;
    res.status(status).json({
      message: err.message || "계좌 등록에 실패했습니다.",
      detail: err.detail || null,
    });
  }
}

/**
 * 출금 요청
 * POST /iframe/ambassador/api/settlement/withdraw
 * body: { amount }
 */
export async function submitWithdrawal(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "유효하지 않은 금액입니다." });
    }

    const result = await submitWithdrawalService({
      ambassador_id: req.user.id,
      amount,
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ submitWithdrawal error:", err.message);
    if (err.message === "INSUFFICIENT_WITHDRAWABLE") {
      return res.status(400).json({
        message: `출금 가능한 포인트가 부족합니다. (출금 가능: ${err.withdrawable ?? 0}pts)`,
      });
    }
    if (err.message === "NO_BENEFICIARY") {
      return res.status(400).json({ message: "등록된 정산 계좌가 없습니다." });
    }
    if (err.message === "POINTS_RECORD_NOT_FOUND") {
      return res.status(404).json({ message: "포인트 정보를 찾을 수 없습니다." });
    }
    const status = err.status || 500;
    res.status(status).json({
      message: err.message || "출금 요청에 실패했습니다.",
      detail: err.detail || null,
    });
  }
}
