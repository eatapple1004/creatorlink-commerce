import * as service from '../services/airwallexBeneficiary.service.js';

export async function createBeneficiary(req, res) {
    console.log(req.body.airwallex_payload);
    const result = await service.registerBeneficiary({
      ambassadorIdx: req.body.ambassador_idx,
      airwallexPayload: req.body.airwallex_payload
    });
  
    res.json({ success: true, result });
}

export async function getBeneficiary(req, res) {
  const ambassadorIdx = Number(req.params.ambassador_idx);
  const idx = Number(req.params.idx);

  const row = await service.getBeneficiary({ ambassadorIdx, idx });
  res.json({ success: true, beneficiary: row });
}

export async function listBeneficiaries(req, res) {
  const ambassadorIdx = Number(req.params.ambassador_idx);
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Number(req.query.offset ?? 0);

  const rows = await service.listBeneficiaries({ ambassadorIdx, limit, offset });
  res.json({ success: true, items: rows, limit, offset });
}

export async function disableBeneficiary(req, res) {
  const ambassadorIdx = Number(req.params.ambassador_idx);
  const idx = Number(req.params.idx);

  const row = await service.disableBeneficiary({ ambassadorIdx, idx });
  res.json({ success: true, beneficiary: row });
}
