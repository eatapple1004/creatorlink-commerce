import paypal from "@paypal/payouts-sdk";
import dotenv from "dotenv";
dotenv.config();

const isSandbox = process.env.PAYPAL_MODE !== "live";

// PayPal 클라이언트 설정
const environment = isSandbox
  ? new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    )
  : new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );

const client = new paypal.core.PayPalHttpClient(environment);

export async function sendPayout({ email, amount }) {
  const requestBody = {
    sender_batch_header: {
      sender_batch_id: `batch_${Date.now()}`,
      email_subject: "Creatorlink Ambassador Reward",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: amount, currency: "USD" },
        receiver: email,
        note: "Thank you for your contribution!",
      },
    ],
  };

  const request = new paypal.payouts.PayoutsPostRequest();
  request.requestBody(requestBody);

  try {
    console.log("📦 [PAYOUT INIT]");
    console.log("🔹 Mode:", process.env.PAYPAL_MODE);
    console.log("🔹 Client ID (앞 6자리):", process.env.PAYPAL_CLIENT_ID?.slice(0, 6) || "N/A");
    console.log("🔹 API Endpoint:", isSandbox 
      ? "https://api-m.sandbox.paypal.com/v1/payments/payouts"
      : "https://api-m.paypal.com/v1/payments/payouts"
    );

    console.log("🚀 Sending payout request...");
    const response = await client.execute(request);

    console.log("✅ [PAYPAL RESPONSE]");
    console.log("🔸 Status:", response.statusCode);
    console.log("🔸 Headers:", response.headers);
    console.log("🔸 Result:", response.result);

    return response.result;
  } catch (err) {
    console.error("❌ [PAYPAL ERROR]");
    console.error("🔸 Status:", err.statusCode || "Unknown");
    console.error("🔸 Message:", err.message || "No message");
    console.error("🔸 Body:", err._originalError?.text || "No body");
    throw err;
  }
}
