import pool from "../src/config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CSV_PATH = "/Users/yongjunlee/Downloads/테스트포함엑셀.csv";

async function run() {
  const client = await pool.connect();
  try {
    // 1) 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_commission (
        item_code         VARCHAR(100) PRIMARY KEY,
        item_price        NUMERIC(10, 2) NOT NULL,
        bronze_commission NUMERIC(5, 2)  NOT NULL DEFAULT 0,
        silver_commission NUMERIC(5, 2)  NOT NULL DEFAULT 0,
        gold_commission   NUMERIC(5, 2)  NOT NULL DEFAULT 0,
        platinum_commission NUMERIC(5, 2) NOT NULL DEFAULT 0,
        diamond_commission  NUMERIC(5, 2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ item_commission 테이블 준비 완료");

    // 2) CSV 파싱
    const raw = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = raw.trim().split("\n").slice(1); // 헤더 제거

    let inserted = 0;
    let skipped = 0;

    for (const line of lines) {
      const [item_code, item_price, bronze, silver, gold, platinum, diamond] =
        line.split(",").map((v) => v.trim());

      if (!item_code) continue;

      await client.query(
        `INSERT INTO item_commission
           (item_code, item_price, bronze_commission, silver_commission,
            gold_commission, platinum_commission, diamond_commission)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (item_code) DO UPDATE SET
           item_price          = EXCLUDED.item_price,
           bronze_commission   = EXCLUDED.bronze_commission,
           silver_commission   = EXCLUDED.silver_commission,
           gold_commission     = EXCLUDED.gold_commission,
           platinum_commission = EXCLUDED.platinum_commission,
           diamond_commission  = EXCLUDED.diamond_commission,
           updated_at          = NOW()`,
        [item_code, item_price, bronze, silver, gold, platinum, diamond]
      );
      inserted++;
    }

    console.log(`✅ 삽입/업데이트 완료: ${inserted}개`);
  } catch (err) {
    console.error("❌ 오류:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
