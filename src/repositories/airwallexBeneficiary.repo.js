import pool from "../config/db.js";

export async function insertCreateRequest(client, {
  ambassador_idx,
  nickname,
  entity_type,
  beneficiary_type,
  transfer_methods,
  personal_email,
  external_identifier,
  country_code,
  city,
  postcode,
  street_address,
  bank_country_code,
  account_currency,
  account_name,
  account_number_masked,
  routing_type1,
  routing_value1,
  date_of_birth,
  request_payload,
}) {
  const sql = `
    insert into public.airwallex_beneficiary (
      ambassador_idx,
      nickname,
      entity_type,
      beneficiary_type,
      transfer_methods,
      personal_email,
      external_identifier,
      country_code,
      city,
      postcode,
      street_address,
      bank_country_code,
      account_currency,
      account_name,
      account_number_masked,
      routing_type1,
      routing_value1,
      date_of_birth,
      request_payload,
      status
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,'CREATED'
    )
    returning *;
  `;
  const values = [
    ambassador_idx,
    nickname,
    entity_type,
    beneficiary_type,
    transfer_methods,
    personal_email,
    external_identifier,
    country_code,
    city,
    postcode,
    street_address,
    bank_country_code,
    account_currency,
    account_name,
    account_number_masked,
    routing_type1,
    routing_value1,
    date_of_birth,
    JSON.stringify(request_payload),
  ];

  const { rows } = await client.query(sql, values);
  return rows[0];
}

export async function updateRegisterSuccess(client, {
  idx,
  airwallex_beneficiary_id,
  response_payload,
}) {
  const sql = `
    update public.airwallex_beneficiary
    set
      airwallex_beneficiary_id = $2,
      response_payload = $3::jsonb,
      status = 'REGISTERED',
      updated_at = now()
    where idx = $1
    returning *;
  `;
  const { rows } = await client.query(sql, [idx, airwallex_beneficiary_id, JSON.stringify(response_payload)]);
  return rows[0];
}

export async function updateRegisterFailed(client, { idx, error_payload }) {
  const sql = `
    update public.airwallex_beneficiary
    set
      response_payload = $2::jsonb,
      status = 'FAILED',
      updated_at = now()
    where idx = $1
    returning *;
  `;
  const { rows } = await client.query(sql, [idx, JSON.stringify(error_payload)]);
  return rows[0];
}

export async function findByIdx({ idx, ambassador_idx }) {
  const sql = `
    select *
    from public.airwallex_beneficiary
    where idx = $1 and ambassador_idx = $2
    limit 1;
  `;
  const { rows } = await pool.query(sql, [idx, ambassador_idx]);
  return rows[0] ?? null;
}

export async function listByAmbassador({ ambassador_idx, limit = 20, offset = 0 }) {
  const sql = `
    select *
    from public.airwallex_beneficiary
    where ambassador_idx = $1
    order by created_at desc
    limit $2 offset $3;
  `;
  const { rows } = await pool.query(sql, [ambassador_idx, limit, offset]);
  return rows;
}

export async function deactivate({ idx, ambassador_idx }) {
  const sql = `
    update public.airwallex_beneficiary
    set is_active = false, status = 'DISABLED', updated_at = now()
    where idx = $1 and ambassador_idx = $2
    returning *;
  `;
  const { rows } = await pool.query(sql, [idx, ambassador_idx]);
  return rows[0] ?? null;
}
