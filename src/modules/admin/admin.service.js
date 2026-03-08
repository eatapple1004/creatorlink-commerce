import pool from "../../config/db.js";
import * as repo from "./admin.repository.js";

export const getSettings = async () => {
  return await repo.getAllSettings();
};

export const toggleSettlement = async (enabled) => {
  await repo.setSetting("settlement_enabled", enabled ? "true" : "false");
  return { settlement_enabled: enabled };
};

export const getStats = async () => {
  return await repo.getAggregateStats();
};

export const searchAmbassadors = async (query, limit, offset) => {
  return await repo.searchAmbassadors({ query, limit, offset });
};

export const getAmbassadorDetail = async (id) => {
  const ambassador = await repo.getAmbassadorById(id);
  if (!ambassador) throw new Error("AMBASSADOR_NOT_FOUND");
  return ambassador;
};

export const getTransfers = async ({ ambassadorId, limit, offset }) => {
  const [items, total] = await Promise.all([
    repo.getTransfers({ ambassadorId, limit, offset }),
    repo.getTransferCount({ ambassadorId }),
  ]);
  return { items, total };
};

export const getTransactions = async ({ ambassadorId, limit, offset }) => {
  return await repo.getTransactions({ ambassadorId, limit, offset });
};

export const adjustPoints = async ({ ambassadorId, amount, description }) => {
  if (!ambassadorId || !amount || amount === 0) {
    throw new Error("INVALID_INPUT");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await repo.adjustPoints(client, { ambassadorId, amount, description });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
};
