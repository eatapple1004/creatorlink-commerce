import express from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as ctrl from '../controllers/airwallexBeneficiary.controller.js';

const router = express.Router();

/**
 * POST /api/airwallex/beneficiaries
 * body: (payload 자체) or { ambassador_idx, payload: {...} }
 */
router.post('/beneficiaries', asyncHandler(ctrl.createBeneficiary));

/**
 * GET /api/airwallex/ambassadors/:ambassador_idx/beneficiaries
 */
router.get('/ambassadors/:ambassador_idx/beneficiaries', asyncHandler(ctrl.listBeneficiaries));

/**
 * GET /api/airwallex/ambassadors/:ambassador_idx/beneficiaries/:idx
 */
router.get('/ambassadors/:ambassador_idx/beneficiaries/:idx', asyncHandler(ctrl.getBeneficiary));

/**
 * PATCH /api/airwallex/ambassadors/:ambassador_idx/beneficiaries/:idx/disable
 */
router.patch('/ambassadors/:ambassador_idx/beneficiaries/:idx/disable', asyncHandler(ctrl.disableBeneficiary));

export default router;
