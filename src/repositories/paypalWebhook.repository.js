/**
 * 웹훅 이벤트 로그 저장
 */
export const logWebhookEvent = async (client, { event_type, payload, linked_request_id = null }) => {
    const q = `
        INSERT INTO payout_webhook_log (event_type, payload, linked_request_id, received_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id;
    `;
    const r = await client.query(q, [event_type, payload, linked_request_id]);
    return r.rows[0];
};
  
/**
 * payout_batch_id 또는 payout_item_id로 withdraw_request 조회
 */
export const findWithdrawByBatchOrItem = async (client, { payoutBatchId, payoutItemId }) => {
    const q = `
        SELECT *
        FROM withdraw_request
        WHERE (payout_batch_id = $1)
            OR (payout_item_id = $2)
        ORDER BY id DESC
        LIMIT 1
    `;
    const r = await client.query(q, [payoutBatchId || null, payoutItemId || null]);
    return r.rows[0];
};
  
/**
 * 출금 성공 반영
 */
export const markWithdrawPaid = async (client, { id, payout_item_id }) => {
    const q = `
        UPDATE withdraw_request
        SET status = 'paid',
            payout_item_id = COALESCE($2, payout_item_id),
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
    `;
    const r = await client.query(q, [id, payout_item_id || null]);
    return r.rows[0];
};
  
/**
 * 출금 실패 반영
 */
export const markWithdrawFailed = async (client, { id, payout_item_id, failure_reason }) => {
    const q = `
      UPDATE withdraw_request
      SET status = 'failed',
          payout_item_id = COALESCE($2, payout_item_id),
          failure_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const r = await client.query(q, [id, payout_item_id || null, failure_reason || null]);
    return r.rows[0];
};

