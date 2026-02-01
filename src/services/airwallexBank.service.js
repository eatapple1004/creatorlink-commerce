import axios from 'axios';
import { getAirwallexAccessToken, getAirwallexBaseUrl } from './airwallexAuth.service.js';
import { findCachedBanks, upsertCachedBanks } from '../repositories/airwallexBank.repo.js';

const TTL_SECONDS = 24 * 60 * 60; // 1일 캐시

export async function getSupportedFinancialInstitutions({
    bankCountryCode,
    accountCurrency,
    entityType,
    transferMethod,
    paymentMethod, // optional
}) {
    // ✅ (1) 캐시 조회: 기존 테이블 키로 매핑
    const cached = await findCachedBanks({
        countryCode: bankCountryCode,
        transferMethod,
        currency: accountCurrency,
        ttlSeconds: TTL_SECONDS,
    });

    if (Array.isArray(cached) && cached.length > 0) {
        return cached;
    }

    const token = await getAirwallexAccessToken();
    const baseUrl = getAirwallexBaseUrl();

    const url = `${baseUrl}/api/v1/beneficiary_form_schemas/supported_financial_institutions`;

    const params = {
        bank_country_code: bankCountryCode,
        account_currency: accountCurrency,
        entity_type: entityType,
        transfer_method: transferMethod,
    };
    if (paymentMethod) params.payment_method = paymentMethod;

    try {
        const resp = await axios.get(url, {
        params,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
        timeout: 20000,
        });

        const banks = normalizeFinancialInstitutions(resp.data);

        console.log('[Airwallex][banks] normalized length=', banks.length);

        // ✅ (2) DB 저장: 기존 테이블 키로 매핑
        if (banks.length > 0) {
        await upsertCachedBanks({
            countryCode: bankCountryCode,
            transferMethod,
            currency: accountCurrency,
            banks,
        });
        }

        return banks;
    } catch (e) {
        console.error('[Airwallex][banks] status=', e.response?.status);
        console.error('[Airwallex][banks] data=', JSON.stringify(e.response?.data, null, 2));
        throw e;
    }
}

function normalizeFinancialInstitutions(data) {
    const raw =
        Array.isArray(data) ? data :
        Array.isArray(data?.items) ? data.items :
        Array.isArray(data?.financial_institutions) ? data.financial_institutions :
        [];

    // ✅ 당신이 로그로 확인한 형태: {label, value}
    return raw
        .map((x) => ({
        name: x.label ?? null,
        bank_code: x.value ?? null,
        bank_identifier: null,
        }))
        .filter((x) => x.name && x.bank_code);
}
