import * as service from "./admin.service.js";
import { getAllGrades, updateAmbassadorGrade } from "./admin.repository.js";
import { getTaxInfo } from "../pointsSettlement/taxInfo.repository.js";
import { decrypt } from "../../utils/encryption.js";

export async function getSettings(req, res) {
  try {
    const settings = await service.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error("admin getSettings error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function toggleSettlement(req, res) {
  try {
    const { enabled } = req.body;
    const result = await service.toggleSettlement(!!enabled);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("admin toggleSettlement error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await service.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error("admin getStats error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function listAmbassadors(req, res) {
  try {
    const query = req.query.q || null;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);
    const items = await service.searchAmbassadors(query, limit, offset);
    res.json({ success: true, items });
  } catch (err) {
    console.error("admin listAmbassadors error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function toggleAmbassadorSettlement(req, res) {
  try {
    const id = Number(req.params.id);
    const { enabled } = req.body;
    const result = await service.toggleAmbassadorSettlement(id, !!enabled);
    res.json({ success: true, result });
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    console.error("admin toggleAmbassadorSettlement error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getAmbassador(req, res) {
  try {
    const id = Number(req.params.id);
    const ambassador = await service.getAmbassadorDetail(id);
    res.json({ success: true, ambassador });
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    console.error("admin getAmbassador error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getTransfers(req, res) {
  try {
    const ambassadorId = req.query.ambassador_id ? Number(req.query.ambassador_id) : null;
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const result = await service.getTransfers({ ambassadorId, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("admin getTransfers error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getTransactions(req, res) {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);
    const items = await service.getTransactions({ ambassadorId: id, limit, offset });
    res.json({ success: true, items });
  } catch (err) {
    console.error("admin getTransactions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

export async function exportTransfers(req, res) {
  try {
    const ambassadorId = req.query.ambassador_id ? Number(req.query.ambassador_id) : null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    const buffer = await service.exportTransfersExcel({ ambassadorId, startDate, endDate });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `transfers_${dateStr}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("admin exportTransfers error:", err.message);
    res.status(500).json({ message: "Export failed" });
  }
}

export async function adjustPoints(req, res) {
  try {
    const { ambassador_id, amount, description } = req.body;
    if (!ambassador_id || !amount) {
      return res.status(400).json({ message: "ambassador_id and amount are required" });
    }
    const result = await service.adjustPoints({
      ambassadorId: Number(ambassador_id),
      amount: parseFloat(amount),
      description,
    });
    res.json({ success: true, result });
  } catch (err) {
    if (err.message === "AMBASSADOR_NOT_FOUND") {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    if (err.message === "INVALID_INPUT") {
      return res.status(400).json({ message: "Invalid input" });
    }
    console.error("admin adjustPoints error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * 등급 목록 조회
 * GET /admin/api/grades
 */
export async function listGrades(req, res) {
  try {
    const grades = await getAllGrades();
    res.json({ success: true, grades });
  } catch (err) {
    console.error("admin listGrades error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * 앰버서더 등급 변경
 * PUT /admin/api/ambassadors/:id/grade
 * body: { grade_id }
 */
export async function changeAmbassadorGrade(req, res) {
  try {
    const id = Number(req.params.id);
    const { grade_id } = req.body;
    if (!grade_id) {
      return res.status(400).json({ message: "grade_id is required" });
    }
    const result = await updateAmbassadorGrade(id, Number(grade_id));
    if (!result) {
      return res.status(404).json({ message: "Ambassador not found" });
    }
    res.json({ success: true, result });
  } catch (err) {
    console.error("admin changeGrade error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * 앰버서더 세무정보 조회 (관리자용 - 주민등록번호 복호화)
 * GET /admin/api/ambassadors/:id/tax-info
 */
export async function getAmbassadorTaxInfo(req, res) {
  try {
    const id = Number(req.params.id);
    const info = await getTaxInfo(id);

    if (!info) {
      return res.json({ success: true, exists: false, tax_info: null });
    }

    const result = {
      entity_type: info.entity_type,
    };

    if (info.entity_type === "individual") {
      result.name = info.name;
      // 주민등록번호 복호화
      if (info.encrypted_ssn && info.ssn_iv && info.ssn_auth_tag) {
        result.ssn = decrypt({
          encrypted: info.encrypted_ssn,
          iv: info.ssn_iv,
          authTag: info.ssn_auth_tag,
        });
        // 포맷: 000000-0000000
        result.ssn_formatted = result.ssn.slice(0, 6) + "-" + result.ssn.slice(6);
      }
    } else {
      result.business_name = info.business_name;
      result.business_number = info.business_number;
      // 포맷: 000-00-00000
      if (info.business_number && info.business_number.length === 10) {
        result.business_number_formatted =
          info.business_number.slice(0, 3) + "-" +
          info.business_number.slice(3, 5) + "-" +
          info.business_number.slice(5);
      }
    }

    result.created_at = info.created_at;
    res.json({ success: true, exists: true, tax_info: result });
  } catch (err) {
    console.error("admin getTaxInfo error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}
