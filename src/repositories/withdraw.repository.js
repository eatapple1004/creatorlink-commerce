// src/repositories/withdraw.repository.js

/**
 * ✅ 특정 앰버서더의 PayPal 이메일 조회
 */
export const getPaypalEmailByAmbassadorId = async (client, ambassador_id) => {
    const query = `
        SELECT paypal_email
        FROM ambassador_profile
        WHERE id = $1
    `;
    const result = await client.query(query, [ambassador_id]);
    return result.rows[0];
};

/**
 * ✅ 출금 요청 생성
 */
export const createWithdrawRequest = async (client, data) => {
    const {
        ambassador_id,
        amount,
        paypal_email,
        status,
        payout_batch_id,
        idempotency_key,
    } = data;

    const query = `
        INSERT INTO withdraw_request 
        (ambassador_id, amount, paypal_email, status, payout_batch_id, idempotency_key, created_at, updated_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *;
    `;

    const values = [
        ambassador_id,
        amount,
        paypal_email,
        status,
        payout_batch_id,
        idempotency_key,
    ];
    const result = await client.query(query, values);
    return result.rows[0];
};

/**
 * ✅ 출금 상태 업데이트
 */
export const updateWithdrawStatus = async (client, id, status, reason = null) => {
    const query = `
        UPDATE withdraw_request 
        SET status = $2, failure_reason = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const result = await client.query(query, [id, status, reason]);
    return result.rows[0];
};
  