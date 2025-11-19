import express from "express";
import shopifyWebhookController from "../controllers/shopifyWebhook.controller.js";

const router = express.Router();

router.post("/orders-create", shopifyWebhookController.handleOrderCreate);
router.post("/orders-paid", shopifyWebhookController.handleOrderPaid);

export default router;
