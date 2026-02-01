import axios from 'axios';
import pool from '../config/db.js';
import { getAirwallexAccessToken, getAirwallexBaseUrl } from './airwallexAuth.service.js';
import * as repo from '../repositories/airwallexTransfer.repo.js';

function assertRequired(payload, keys) {
    for (const k of keys) {
        if (payload?.[k] === undefined || payload?.[k] === null || payload?.[k] === '') {
        const err = new Error(`missing required field: ${k}`);
        err.status = 400;
        throw err;
        }
    }
}

/**
 * Airwallex transfer create
 * POST /api/v1/transfers/create
 */
export async function createTransfer({ ambassadorIdx, payload }) {
    console.log(payload);
    
    // ✅ Postman 샘플 기준 최소 필수 필드
    assertRequired(payload, [
        'beneficiary_id',
        'transfer_amount',
        'transfer_currency',
        'transfer_method',
        'reason',
        'reference',
        'request_id',
    ]);

    // request_id 중복 방지(우리 DB 기준)
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await repo.findByRequestId(client, payload.request_id);
        if (existing?.response_json) {
        // 이미 성공 응답까지 저장되어 있으면 그대로 반환 (idempotent)
        await client.query('COMMIT');
        return existing;
        }
        if (!existing) {
            // 요청 로그 먼저 저장 (성공/실패와 무관하게 trace 가능)
            await repo.insertRequest(client, {
                ambassador_idx: ambassadorIdx,
                request_id: payload.request_id,
                reference: payload.reference,
                beneficiary_id: payload.beneficiary_id,
                transfer_amount: payload.transfer_amount,
                transfer_currency: payload.transfer_currency,
                transfer_method: payload.transfer_method,
                source_amount: payload.source_amount ?? null,
                source_currency: payload.source_currency ?? null,
                swift_charge_option: payload.swift_charge_option ?? null,
                reason: payload.reason ?? null,
                remarks: payload.remarks ?? null,
                request_json: payload,
            });
        }

        // ✅ Airwallex 호출
        const token = await getAirwallexAccessToken();
        const baseUrl = getAirwallexBaseUrl();
        const url = `${baseUrl}/api/v1/transfers/create`;

        let resp;
        try {
            resp = await axios.post(url, payload, {
                headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                },
                timeout: 20000,
            });
        } catch (e) {
            const errObj = {
                status: e.response?.status ?? null,
                data: e.response?.data ?? null,
                message: e.message,
            };
            await repo.markFailure(client, payload.request_id, errObj);
            await client.query('COMMIT');

            const err = new Error(`Airwallex transfer create failed: ${e.response?.status ?? 'unknown'}`);
            err.status = 502;
            err.detail = errObj;
            throw err;
        }

        // ✅ 성공 응답 저장
        const saved = await repo.markSuccess(client, payload.request_id, resp.data);

        await client.query('COMMIT');
        return saved;
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
    } finally {
        client.release();
    }
}

export async function getTransferByRequestId({ requestId }) {
  return await repo.findByRequestId(pool, requestId);
}

export async function getTransferByIdx({ idx }) {
  return await repo.findByIdx(pool, idx);
}
