import express from 'express';
import * as ctrl from '../controllers/airwallexTransfer.controller.js';

const router = express.Router();

/**
 * payout(transfer) 생성
 * POST /api/airwallex/transfers
 */
router.post('/transfers', ctrl.createTransfer);

/**
 * transfer 조회(우리 DB 기준)
 * GET /api/airwallex/transfers?request_id=...
 * GET /api/airwallex/transfers/:idx
 */
router.get('/transfers', ctrl.getTransferByRequestId);
router.get('/transfers/:idx', ctrl.getTransferByIdx);

export default router;
