import { v4 as uuidv4 } from "uuid";
import {
  getSettlementSummary,
  getActiveBankAccount,
  getActiveBeneficiary,
  getSettlementHistory,
} from "./pointsSettlement.repository.js";
import {
  findPointsByAmbassador,
  savePoints,
  insertTransaction,
  getLockedPoints,
} from "../../repositories/points.repository.js";
import { registerBeneficiary } from "../../services/airwallexBeneficiary.service.js";
import { createTransfer } from "../../services/airwallexTransfer.service.js";

const PENDING_STATUSES = new Set(["CREATED", "INITIATED", "PENDING", "PROCESSING"]);

/**
 * 정산 페이지 전체 데이터
 */
export const getSettlementPageDataService = async (ambassadorId) => {
  const [summary, bankAccount, history] = await Promise.all([
    getSettlementSummary(ambassadorId),
    getActiveBankAccount(ambassadorId),
    getSettlementHistory(ambassadorId),
  ]);

  if (!summary) throw new Error("POINTS_RECORD_NOT_FOUND");

  const currentPoints = parseFloat(summary.current_points);
  const lockedPoints = parseFloat(summary.locked_points);
  const withdrawablePoints = Math.max(0, currentPoints - lockedPoints);

  const pending = history.filter((h) =>
    PENDING_STATUSES.has(h.status?.toUpperCase())
  );

  return {
    current_points: currentPoints,
    locked_points: lockedPoints,
    withdrawable_points: withdrawablePoints,
    bank_account: bankAccount,
    pending,
    history,
  };
};

/**
 * 활성 수취인 계좌 존재 여부 확인
 */
export const checkBeneficiaryService = async (ambassadorId) => {
  const beneficiary = await getActiveBeneficiary(ambassadorId);
  return beneficiary || null;
};

/**
 * 수취인(정산 계좌) 등록
 * - 한국 KRW LOCAL 이체 기준
 */
export const registerBeneficiaryService = async (ambassadorId, {
  account_name,
  account_number,
  bank_code,
  bank_name,
  date_of_birth,
  email,
}) => {
  const airwallexPayload = {
    nickname: `${account_name}_KRW`,
    payer_entity_type: "PERSONAL",
    transfer_methods: ["LOCAL"],
    beneficiary: {
      entity_type: "PERSONAL",
      type: "BANK_ACCOUNT",
      date_of_birth,
      additional_info: {
        personal_email: email,
      },
      address: {
        country_code: "KR",
      },
      bank_details: {
        bank_country_code: "KR",
        account_currency: "KRW",
        account_name,
        account_number,
        // KR LOCAL 이체는 routing type 불필요 (error code 011)
        // bank_name은 있을 때만 포함
        ...(bank_name && { bank_name }),
      },
    },
  };

  return await registerBeneficiary({
    ambassadorIdx: ambassadorId,
    airwallexPayload,
  });
};

/**
 * Airwallex 출금 요청
 * 1) 포인트/잠금 체크
 * 2) 포인트 선차감 (DB)
 * 3) Airwallex Transfer API 호출
 * 4) 실패 시 포인트 복원 (보상 트랜잭션)
 */
export const submitWithdrawalService = async ({ ambassador_id, amount }) => {
  // 1. 포인트 확인
  const record = await findPointsByAmbassador(ambassador_id);
  if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");

  const lockedPoints = await getLockedPoints(ambassador_id);
  const current    = parseFloat(record.current_points);
  const earned     = parseFloat(record.total_earned);
  const withdrawn  = parseFloat(record.total_withdrawn);
  const withdrawable = Math.max(0, current - lockedPoints);

  if (withdrawable < amount) {
    const err = new Error("INSUFFICIENT_WITHDRAWABLE");
    err.withdrawable = withdrawable;
    throw err;
  }

  // 2. 활성 수취인 확인
  const beneficiary = await getActiveBeneficiary(ambassador_id);
  if (!beneficiary?.airwallex_beneficiary_id) throw new Error("NO_BENEFICIARY");

  // 3. 포인트 선차감
  const requestId  = `amb-${ambassador_id}-${uuidv4()}`;
  const newBalance = current - amount;

  await savePoints(ambassador_id, {
    current_points:  newBalance,
    total_earned:    earned,
    total_withdrawn: withdrawn + amount,
  });
  await insertTransaction({
    ambassador_id,
    type: "withdraw",
    amount: -amount,
    balance_after: newBalance,
    reference_type: "AIRWALLEX_TRANSFER",
    reference_id: requestId,
    description: "Airwallex 정산 출금",
  });

  // 4. Airwallex Transfer API 호출
  try {
    const transfer = await createTransfer({
      ambassadorIdx: ambassador_id,
      payload: {
        beneficiary_id:   beneficiary.airwallex_beneficiary_id,
        transfer_amount:  amount,
        transfer_currency: "KRW",
        transfer_method:  "LOCAL",
        reason:    "Ambassador commission payout",
        reference: `AMB-${ambassador_id}-${Date.now()}`,
        request_id: requestId,
      },
    });
    return transfer;
  } catch (err) {
    // 보상 트랜잭션: 포인트 복원
    try {
      await savePoints(ambassador_id, {
        current_points:  current,
        total_earned:    earned,
        total_withdrawn: withdrawn,
      });
      await insertTransaction({
        ambassador_id,
        type: "earn",
        amount,
        balance_after: current,
        reference_type: "AIRWALLEX_REVERSAL",
        reference_id: requestId,
        description: "Airwallex 정산 실패 - 포인트 복원",
      });
    } catch (compensateErr) {
      console.error("CRITICAL: 포인트 복원 실패", compensateErr);
    }
    throw err;
  }
};
