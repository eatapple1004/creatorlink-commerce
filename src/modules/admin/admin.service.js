import pool from "../../config/db.js";
import * as XLSX from "xlsx";
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

export const exportTransfersExcel = async ({ ambassadorId, startDate, endDate }) => {
  const rows = await repo.getTransfersForExport({ ambassadorId, startDate, endDate });

  const data = rows.map((r) => ({
    "IDX": r.idx,
    "Ambassador ID": r.ambassador_idx,
    "Name": r.ambassador_name || "",
    "Email": r.ambassador_email || "",
    "Transfer Amount": parseFloat(r.transfer_amount) || 0,
    "Transfer Currency": r.transfer_currency || "",
    "Source Amount": r.source_amount ? parseFloat(r.source_amount) : "",
    "Source Currency": r.source_currency || "",
    "Status": r.status || "",
    "Transfer Method": r.transfer_method || "",
    "Reference": r.reference || "",
    "Airwallex Transfer ID": r.airwallex_transfer_id || "",
    "Short Reference": r.airwallex_short_reference_id || "",
    "Reason": r.reason || "",
    "Created At": r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ") : "",
    "Updated At": r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 19).replace("T", " ") : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  ws["!cols"] = [
    { wch: 6 },  // IDX
    { wch: 12 }, // Ambassador ID
    { wch: 16 }, // Name
    { wch: 24 }, // Email
    { wch: 14 }, // Transfer Amount
    { wch: 10 }, // Transfer Currency
    { wch: 14 }, // Source Amount
    { wch: 10 }, // Source Currency
    { wch: 12 }, // Status
    { wch: 12 }, // Transfer Method
    { wch: 24 }, // Reference
    { wch: 36 }, // Airwallex Transfer ID
    { wch: 18 }, // Short Reference
    { wch: 20 }, // Reason
    { wch: 20 }, // Created At
    { wch: 20 }, // Updated At
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Transfers");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
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
