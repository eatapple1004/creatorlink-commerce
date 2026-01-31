export function maskAccountNumber(accountNumber) {
    if (!accountNumber) return null;
    const s = String(accountNumber).replace(/\s+/g, '');
    if (s.length <= 4) return `****${s}`;
    const last4 = s.slice(-4);
    return `****-****-${last4}`;
}
  