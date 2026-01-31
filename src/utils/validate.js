export function assert(condition, message) {
    if (!condition) {
      const err = new Error(message);
      err.status = 400;
      throw err;
    }
}
  
export function validateBeneficiaryCreateBody(body) {
    assert(body && typeof body === 'object', 'body is required');
  
    const b = body.beneficiary;
    assert(b, 'beneficiary is required');
  
    assert(b.type === 'BANK_ACCOUNT', 'beneficiary.type must be BANK_ACCOUNT');
    assert(b.entity_type === 'PERSONAL' || b.entity_type === 'COMPANY', 'beneficiary.entity_type must be PERSONAL or COMPANY');
  
    assert(b.address?.country_code, 'beneficiary.address.country_code is required');
    assert(b.address?.city, 'beneficiary.address.city is required');
    assert(b.address?.postcode, 'beneficiary.address.postcode is required');
    assert(b.address?.street_address, 'beneficiary.address.street_address is required');
  
    const bank = b.bank_details;
    assert(bank?.bank_country_code, 'beneficiary.bank_details.bank_country_code is required');
    assert(bank?.account_currency, 'beneficiary.bank_details.account_currency is required');
    assert(bank?.account_name, 'beneficiary.bank_details.account_name is required');
    assert(bank?.account_number, 'beneficiary.bank_details.account_number is required');
    assert(bank?.account_routing_type1, 'beneficiary.bank_details.account_routing_type1 is required');
    assert(bank?.account_routing_value1, 'beneficiary.bank_details.account_routing_value1 is required');
  
    assert(b.date_of_birth, 'beneficiary.date_of_birth is required');
  
    assert(Array.isArray(body.transfer_methods) && body.transfer_methods.length > 0, 'transfer_methods must be non-empty array');
    assert(body.nickname, 'nickname is required');
}
  