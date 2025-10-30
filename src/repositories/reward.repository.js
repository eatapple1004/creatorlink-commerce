// src/repositories/reward.repository.js
import pool from "../config/db.js";

export const findCreatorByReferralCode = async (referralCode) => {
  const result = await pool.query(
    "SELECT creator_id FROM referral_codes WHERE code = $1",
    [referralCode]
  );
  return result.rows[0] || null;
};

export const insertRewardRecord = async (creatorId, referralCode, amount, points) => {
  await pool.query(
    `INSERT INTO reward_points (creator_id, referral_code, amount, points)
     VALUES ($1, $2, $3, $4)`,
    [creatorId, referralCode, amount, points]
  );
};

export const getTotalPointsByCreator = async (creatorId) => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(points), 0) AS total_points
     FROM reward_points
     WHERE creator_id = $1`,
    [creatorId]
  );
  return result.rows[0].total_points;
};



export const getRewardSummary = async (creatorId) => {
    const query = `
      SELECT 
        COALESCE(SUM(points), 0) AS total_points
      FROM reward_points
      WHERE creator_id = $1
    `;
    const { rows } = await pool.query(query, [creatorId]);
    return rows[0];
};
