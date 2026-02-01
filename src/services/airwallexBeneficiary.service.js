import axios from 'axios';
import pool from "../config/db.js";
import { maskAccountNumber } from '../utils/mask.js';
import { validateBeneficiaryCreateBody } from '../utils/validate.js';
import { getAirwallexAccessToken, getAirwallexBaseUrl } from './airwallexAuth.service.js';
import * as repo from '../repositories/airwallexBeneficiary.repo.js';

export async function registerBeneficiary({ ambassadorIdx, airwallexPayload }) {
    if (!ambassadorIdx) {
        const err = new Error('ambassadorIdx is required');
        err.status = 400;
        throw err;
    }
    if (!airwallexPayload || Object.keys(airwallexPayload).length === 0) {
        const err = new Error('airwallexPayload is required');
        err.status = 400;
        throw err;
    }
  
    // ✅ request payload에서 필요한 필드만 컬럼으로 뽑아 저장 (나머지는 request_payload jsonb로)
    const b = airwallexPayload.beneficiary ?? {};
    const addi = b.additional_info ?? {};
    const addr = b.address ?? {};
    const bank = b.bank_details ?? {};
  
    // 계좌번호는 마스킹만 컬럼 저장(원본은 request_payload에 있음 -> 운영 정책에 따라 원본도 마스킹 권장)
    const accountNumberMasked = maskAccountNumber(bank.account_number);
  
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
    
        // 1) 요청 스냅샷 먼저 insert (CREATED)
        const inserted = await repo.insertCreateRequest(client, {
            ambassador_idx: ambassadorIdx,
            nickname: airwallexPayload.nickname ?? null,
            payer_entity_type: airwallexPayload.payer_entity_type ?? null,
            entity_type: b.entity_type ?? null,
            beneficiary_type: b.type ?? null,
            transfer_methods: airwallexPayload.transfer_methods ?? null,
    
            personal_email: addi.personal_email ?? null,
            external_identifier: addi.external_identifier ?? null,
    
            country_code: addr.country_code ?? null,
            city: addr.city ?? null,
            postcode: addr.postcode ?? null,
            street_address: addr.street_address ?? null,
    
            bank_country_code: bank.bank_country_code ?? null,
            bank_name: bank.bank_name ?? null,
            account_currency: bank.account_currency ?? null,
            account_name: bank.account_name ?? null,
            account_number_masked: accountNumberMasked,
            routing_type1: bank.account_routing_type1 ?? null,
            routing_value1: bank.account_routing_value1 ?? null,
    
            date_of_birth: b.date_of_birth ?? null,
    
            request_payload: airwallexPayload,
        });
    
        // 2) Airwallex 호출
        const token = await getAirwallexAccessToken();
        const baseUrl = getAirwallexBaseUrl();
        const url = `${baseUrl}/api/v1/beneficiaries/create`;
    
        let resp;
        try {
            resp = await axios.post(url, airwallexPayload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 20000,
            });
        } catch (e) {
            const errorPayload = {
            message: e.message,
            status: e.response?.status,
            data: e.response?.data,
            };
    
            // 2-1) 실패 업데이트
            await repo.updateRegisterFailed(client, { idx: inserted.idx, error_payload: errorPayload });
    
            await client.query('COMMIT');
    
            const err = new Error(`Airwallex beneficiary create failed: ${errorPayload.status ?? ''}`);
            err.status = 502;
            err.detail = errorPayload;
            throw err;
        }
    
        const responseData = resp.data;
        const airwallexBeneficiaryId = responseData?.id;
    
        if (!airwallexBeneficiaryId) {
            const errorPayload = { message: 'Airwallex response missing id', data: responseData };
    
            await repo.updateRegisterFailed(client, { idx: inserted.idx, error_payload: errorPayload });
            await client.query('COMMIT');
    
            const err = new Error('Airwallex response missing beneficiary id');
            err.status = 502;
            err.detail = errorPayload;
            throw err;
        }
    
        // 3) 성공 업데이트
        const updated = await repo.updateRegisterSuccess(client, {
            idx: inserted.idx,
            airwallex_beneficiary_id: airwallexBeneficiaryId,
            response_payload: responseData,
        });
    
        await client.query('COMMIT');
        return updated;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
    } finally {
        client.release();
    }
}

export async function getBeneficiary({ ambassadorIdx, idx }) {
  const row = await repo.findByIdx({ idx, ambassador_idx: ambassadorIdx });
  if (!row) {
    const err = new Error('beneficiary not found');
    err.status = 404;
    throw err;
  }
  return row;
}

export async function listBeneficiaries({ ambassadorIdx, limit, offset }) {
  return await repo.listByAmbassador({ ambassador_idx: ambassadorIdx, limit, offset });
}

export async function disableBeneficiary({ ambassadorIdx, idx }) {
  const row = await repo.deactivate({ idx, ambassador_idx: ambassadorIdx });
  if (!row) {
    const err = new Error('beneficiary not found');
    err.status = 404;
    throw err;
  }
  return row;
}
