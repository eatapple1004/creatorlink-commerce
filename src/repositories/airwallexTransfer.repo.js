import pool from '../config/db.js';

export async function findByRequestId(clientOrPool, requestId) {
  const { rows } = await clientOrPool.query(
    `
    SELECT *
    FROM public.airwallex_transfer
    WHERE request_id = $1
    LIMIT 1
    `,
    [requestId]
  );
  return rows[0] ?? null;
}

export async function findByIdx(clientOrPool, idx) {
  const { rows } = await clientOrPool.query(
    `
    SELECT *
    FROM public.airwallex_transfer
    WHERE idx = $1
    LIMIT 1
    `,
    [idx]
  );
  return rows[0] ?? null;
}

export async function insertRequest(client, data) {
  const { rows } = await client.query(
    `
    INSERT INTO public.airwallex_transfer
      (ambassador_idx, request_id, reference, beneficiary_id,
       transfer_amount, transfer_currency, transfer_method,
       source_amount, source_currency, swift_charge_option, reason, remarks,
       request_json)
    VALUES
      ($1,$2,$3,$4,
       $5,$6,$7,
       $8,$9,$10,$11,$12,
       $13::jsonb)
    RETURNING *
    `,
    [
      data.ambassador_idx,
      data.request_id,
      data.reference ?? null,
      data.beneficiary_id,

      data.transfer_amount,
      data.transfer_currency,
      data.transfer_method,

      data.source_amount ?? null,
      data.source_currency ?? null,
      data.swift_charge_option ?? null,
      data.reason ?? null,
      data.remarks ?? null,

      JSON.stringify(data.request_json),
    ]
  );
  return rows[0];
}

export async function markSuccess(client, requestId, respData) {
  const { rows } = await client.query(
    `
    UPDATE public.airwallex_transfer
    SET airwallex_transfer_id = $2,
        airwallex_short_reference_id = $3,
        status = $4,
        response_json = $5::jsonb,
        error_json = NULL,
        updated_at = now()
    WHERE request_id = $1
    RETURNING *
    `,
    [
      requestId,
      respData?.id ?? null,
      respData?.short_reference_id ?? null,
      respData?.status ?? null,
      JSON.stringify(respData ?? null),
    ]
  );
  return rows[0];
}

export async function markFailure(client, requestId, errObj) {
  const { rows } = await client.query(
    `
    UPDATE public.airwallex_transfer
    SET error_json = $2::jsonb,
        updated_at = now()
    WHERE request_id = $1
    RETURNING *
    `,
    [requestId, JSON.stringify(errObj ?? null)]
  );
  return rows[0];
}
