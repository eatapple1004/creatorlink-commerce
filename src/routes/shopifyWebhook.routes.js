import express from "express";
import * as shopifyWebhookController from "../controllers/shopifyWebhook.controller.js";

const router = express.Router();

router.post("/order-create", shopifyWebhookController.handleOrderCreate);
router.post("/order-paid", shopifyWebhookController.handleOrderPaid);

export default router;
