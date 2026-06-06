import express from "express";
import * as shopifyOAuthController from "../controllers/shopifyOAuth.controller.js";

const router = express.Router();

// GET /api/shopify/oauth/install?shop=<myshopify도메인>
router.get("/install", shopifyOAuthController.install);
// GET /api/shopify/oauth/callback  (Shopify 리다이렉트)
router.get("/callback", shopifyOAuthController.callback);

export default router;
