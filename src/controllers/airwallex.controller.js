import { getAirwallexTokenInfo } from '../services/airwallex.service.js';

/**
 * GET /api/airwallex/token
 * - 기본: token 숨기고 expires_at만 내려줌
 * - ?include_token=true 일 때만 token 포함 (내부 테스트용)
 */
export const getToken = async (req, res) => {
    try {
        const includeToken = String(req.query.include_token || '').toLowerCase() === 'true';

        const info = await getAirwallexTokenInfo(); 
        // info: { token, expires_at, expires_at_ms }

        if (includeToken) {
        return res.json({
            success: true,
            token: info.token,
            expires_at: info.expires_at,
        });
        }

        return res.json({
        success: true,
        expires_at: info.expires_at,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
