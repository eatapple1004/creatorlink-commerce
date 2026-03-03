import {
  getSettlementSummary,
  getActiveBankAccount,
  getSettlementHistory,
} from "./pointsSettlement.repository.js";

const PENDING_STATUSES = new Set(["CREATED", "INITIATED", "PENDING", "PROCESSING"]);

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
