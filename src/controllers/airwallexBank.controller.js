import * as service from '../services/airwallexBank.service.js';

export async function listSupportedFinancialInstitutions(req, res) {
  const bankCountryCode = (req.query.bank_country_code ?? 'KR').toString();
  const accountCurrency = (req.query.account_currency ?? 'KRW').toString();
  const entityType = (req.query.entity_type ?? 'PERSONAL').toString();
  const transferMethod = (req.query.transfer_method ?? 'LOCAL').toString();
  const paymentMethod = req.query.payment_method ? req.query.payment_method.toString() : undefined;

  const banks = await service.getSupportedFinancialInstitutions({
    bankCountryCode,
    accountCurrency,
    entityType,
    transferMethod,
    paymentMethod,
  });

  res.json({ success: true, banks });
}
