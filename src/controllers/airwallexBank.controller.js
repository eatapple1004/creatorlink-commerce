import * as service from '../services/airwallexBank.service.js';

export async function listSupportedBanks(req, res) {
  const countryCode = (req.query.country_code ?? 'KR').toString();
  const transferMethod = (req.query.transfer_method ?? 'LOCAL').toString();
  const currency = (req.query.currency ?? 'KRW').toString();

  const result = await service.getSupportedBanks({ countryCode, transferMethod, currency });
  res.json({ success: true, banks: result });
}
