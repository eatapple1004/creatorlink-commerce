// src/config/dbClient.js
import pool from './db.js';

/**
 * 단일 쿼리 실행용
 * @param {string} text - SQL 문
 * @param {Array} params - 바인딩 파라미터
 * @returns {Promise<object>} - 쿼리 결과 객체
 */
export async function query(text, params = []) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    //console.log(`🧩 Query executed (${duration}ms):`, text);
    return res;
}

/**
 * 트랜잭션 헬퍼
 * @param {Function} callback - 클라이언트 기반 트랜잭션 실행 함수
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}
