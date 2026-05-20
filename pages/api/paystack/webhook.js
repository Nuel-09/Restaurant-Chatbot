const crypto = require("crypto");
const { connectToDatabase } = require("../../../../lib/mongoose");
const Payment = require("../../../../models/Payment");
const Order = require("../../../../models/Order");

module.exports = async function handler(req, res) {
  const { method } = req;
  if (method !== "POST") return res.status(405).end();

  try {
    // Verify Paystack webhook signature
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      await connectToDatabase();

      const { reference, amount } = data;
      let payment = await Payment.findOne({ reference });

      if (!payment) {
        payment = new Payment({
          reference,
          status: "verified",
          amount,
          raw: data,
          verifiedAt: new Date(),
        });
        await payment.save();
        return res.json({ status: "ok", message: "Payment recorded" });
      }

      if (payment.status !== "verified") {
        payment.status = "verified";
        payment.verifiedAt = new Date();
        payment.raw = data;
        await payment.save();

        if (payment.orderId) {
          const order = await Order.findById(payment.orderId);
          if (order) {
            order.status = "paid";
            order.paidAt = new Date();
            order.paymentRef = reference;
            await order.save();
          }
        }
      }

      return res.json({ status: "ok" });
    }

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};
