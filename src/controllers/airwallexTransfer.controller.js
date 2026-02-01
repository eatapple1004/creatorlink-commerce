import * as service from '../services/airwallexTransfer.service.js';

export async function createTransfer(req, res) {
  // 프론트/포스트맨이 주는 body를 거의 그대로 받되, 최소 필드 검증만 합니다.
  const result = await service.createTransfer({
    ambassadorIdx: req.body.ambassador_idx ?? null,
    payload: req.body.airwallex_payload ?? req.body, // 둘 다 지원
  });

  res.json({ success: true, result });
}

export async function getTransferByRequestId(req, res) {
  const requestId = req.query.request_id?.toString();
  if (!requestId) return res.status(400).json({ success: false, error: 'request_id is required' });

  const row = await service.getTransferByRequestId({ requestId });
  res.json({ success: true, row });
}

export async function getTransferByIdx(req, res) {
  const idx = Number(req.params.idx);
  const row = await service.getTransferByIdx({ idx });
  res.json({ success: true, row });
}
