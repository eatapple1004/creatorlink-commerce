import shopifyWebhookService from "../services/shopifyWebhook.service.js";
import crypto from "crypto";

function verifyHmac(req) {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const body = req.body;

    const generated = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("base64");

    return generated === hmacHeader;
}

export default {
    handleOrderCreate: async (req, res) => {
        try {
        if (!verifyHmac(req)) return res.status(401).send("invalid hmac");

        const data = JSON.parse(req.body.toString());
        await shopifyWebhookService.processOrderCreate(data);

        res.status(200).send("ok");
        } catch (err) {
        console.error("error - shopify create:", err);
        res.status(500).send("server error");
        }
    },

    handleOrderPaid: async (req, res) => {
        try {
            if (!verifyHmac(req)) return res.status(401).send("invalid hmac");

            const data = JSON.parse(req.body.toString());
            await shopifyWebhookService.processOrderPaid(data);

            res.status(200).send("ok");
        } catch (err) {
        console.error("error - shopify paid:", err);
        res.status(500).send("server error");
        }
    }
};
