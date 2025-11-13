export function generateReferralCode(name = "") {
    const prefix = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "AMB";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
}
  