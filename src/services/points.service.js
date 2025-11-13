import {
    getPointsByAmbassador,
    updatePoints,
    insertTransactionLog,
} from "../repositories/points.repository.js";
import { transaction } from "../config/dbClient.js";
  
// 포인트 적립
export const addPointsService = async ({ ambassador_id, amount, description }) => {
    return transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM ambassador_points WHERE ambassador_id = $1 FOR UPDATE",
        [ambassador_id]
      );
      const record = rows[0];
  
      if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");
  
      const newCurrent = record.current_points + amount;
      const newEarned = record.total_earned + amount;
  
      // 업데이트
      await client.query(
        `
        UPDATE ambassador_points
        SET current_points = $1, total_earned = $2, last_updated_at = NOW()
        WHERE ambassador_id = $3;
      `,
        [newCurrent, newEarned, ambassador_id]
      );
  
      // 트랜잭션 로그 기록
      await insertTransactionLog({
        ambassador_id,
        type: "earn",
        amount,
        balance_after: newCurrent,
        description,
      });
  
      return { current_points: newCurrent, total_earned: newEarned };
    });
  };
  
// 포인트 출금 (차감)
export const withdrawPointsService = async ({ ambassador_id, amount, description }) => {
    return transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM ambassador_points WHERE ambassador_id = $1 FOR UPDATE",
        [ambassador_id]
      );
      const record = rows[0];
  
      if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");
      if (record.current_points < amount) throw new Error("INSUFFICIENT_BALANCE");
  
      const newCurrent = record.current_points - amount;
      const newWithdrawn = record.total_withdrawn + amount;
  
      await client.query(
        `
        UPDATE ambassador_points
        SET current_points = $1, total_withdrawn = $2, last_updated_at = NOW()
        WHERE ambassador_id = $3;
      `,
        [newCurrent, newWithdrawn, ambassador_id]
      );
  
      await insertTransactionLog({
        ambassador_id,
        type: "withdraw",
        amount: -amount,
        balance_after: newCurrent,
        description,
      });
  
      return { current_points: newCurrent, total_withdrawn: newWithdrawn };
    });
};
  