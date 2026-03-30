import {
  getSettlementPageDataService,
  checkBeneficiaryService,
  registerBeneficiaryService,
  submitWithdrawalService,
} from "./pointsSettlement.service.js";
import { deactivateBeneficiary } from "./pointsSettlement.repository.js";
import { getTaxInfoSummary, upsertTaxInfo } from "./taxInfo.repository.js";
import { encrypt } from "../../utils/encryption.js";

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

    console.log('[settlement] registerBeneficiary body:', JSON.stringify({
      account_name, account_number, bank_code, date_of_birth,
      email, city, postcode, street_address,
    }));

    const missing = [];
    if (!account_name)   missing.push('account_name');
    if (!account_number) missing.push('account_number');
    if (!bank_code)      missing.push('bank_code');
    if (!date_of_birth)  missing.push('date_of_birth');
    if (!city)           missing.push('city');
    if (!postcode)       missing.push('postcode');
    if (!street_address) missing.push('street_address');

    if (missing.length > 0) {
      console.warn('[settlement] missing fields:', missing);
      return res.status(400).json({ message: `필수 항목 누락: ${missing.join(', ')}` });
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
    if (err.message === "TAX_INFO_REQUIRED") {
      return res.status(400).json({
        message: "세무정보 등록이 필요합니다.",
        code: "TAX_INFO_REQUIRED",
      });
    }
    if (err.message === "SETTLEMENT_DISABLED") {
      return res.status(403).json({
        message: "Settlement is currently disabled.",
      });
    }
    if (err.message === "AMBASSADOR_SETTLEMENT_BLOCKED") {
      return res.status(403).json({
        message: "Your settlement has been temporarily blocked. Please contact support.",
      });
    }
    if (err.message === "BELOW_MINIMUM_AMOUNT") {
      return res.status(400).json({
        message: `최소 정산 금액은 ${(err.minimum ?? 2000).toLocaleString()}pts 입니다.`,
      });
    }
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

/**
 * 정산 계좌 비활성화 (계좌 변경 시)
 * DELETE /iframe/ambassador/api/settlement/beneficiary
 */
export async function deleteBeneficiary(req, res) {
  try {
    await deactivateBeneficiary(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ deleteBeneficiary error:", err.message);
    res.status(500).json({ message: "계좌 해제에 실패했습니다." });
  }
}

/**
 * 세무정보 조회 (민감정보 제외)
 * GET /iframe/ambassador/api/settlement/tax-info
 */
export async function getTaxInfoHandler(req, res) {
  try {
    const info = await getTaxInfoSummary(req.user.id);
    res.json({ exists: !!info, tax_info: info || null });
  } catch (err) {
    console.error("❌ getTaxInfo error:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
}

/**
 * 세무정보 등록
 * POST /iframe/ambassador/api/settlement/tax-info
 * body: { entity_type, name, ssn, business_name, business_number }
 *
 * entity_type: "individual" | "business"
 * individual → name + ssn (주민등록번호, 암호화 저장)
 * business   → business_name + business_number (사업자등록번호)
 */
export async function registerTaxInfo(req, res) {
  try {
    const { entity_type, name, ssn, business_name, business_number } = req.body;

    if (!entity_type || !["individual", "business"].includes(entity_type)) {
      return res.status(400).json({ message: "유형을 선택해주세요. (individual 또는 business)" });
    }

    if (entity_type === "individual") {
      if (!name || !ssn) {
        return res.status(400).json({ message: "이름과 주민등록번호를 입력해주세요." });
      }
      // 주민등록번호 형식 검증 (13자리 숫자, 하이픈 제거 후)
      const ssnClean = ssn.replace(/-/g, "");
      if (!/^\d{13}$/.test(ssnClean)) {
        return res.status(400).json({ message: "주민등록번호 형식이 올바르지 않습니다. (13자리)" });
      }

      // AES-256-GCM 암호화
      const { encrypted, iv, authTag } = encrypt(ssnClean);

      const result = await upsertTaxInfo({
        ambassador_id: req.user.id,
        entity_type: "individual",
        name,
        encrypted_ssn: encrypted,
        ssn_iv: iv,
        ssn_auth_tag: authTag,
        business_name: null,
        business_number: null,
      });

      return res.json({
        success: true,
        tax_info: {
          entity_type: result.entity_type,
          name: result.name,
        },
      });
    }

    // business
    if (!business_name || !business_number) {
      return res.status(400).json({ message: "상호명과 사업자번호를 입력해주세요." });
    }
    // 사업자번호 형식 검증 (10자리 숫자, 하이픈 제거 후)
    const bnClean = business_number.replace(/-/g, "");
    if (!/^\d{10}$/.test(bnClean)) {
      return res.status(400).json({ message: "사업자번호 형식이 올바르지 않습니다. (10자리)" });
    }

    const result = await upsertTaxInfo({
      ambassador_id: req.user.id,
      entity_type: "business",
      name: null,
      encrypted_ssn: null,
      ssn_iv: null,
      ssn_auth_tag: null,
      business_name,
      business_number: bnClean,
    });

    return res.json({
      success: true,
      tax_info: {
        entity_type: result.entity_type,
        business_name: result.business_name,
        business_number: result.business_number,
      },
    });
  } catch (err) {
    console.error("❌ registerTaxInfo error:", err.message);
    res.status(500).json({ message: "세무정보 등록에 실패했습니다." });
  }
}
