const { connectToDatabase } = require("../../../../lib/mongoose");
const Payment = require("../../../../models/Payment");
const Order = require("../../../../models/Order");
const fetch = global.fetch || require("node-fetch");

module.exports = async function handler(req, res) {
  const { query } = req;
  const { reference } = query;
  if (!reference) return res.status(400).json({ error: "reference required" });

  const PAYSTACK = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK)
    return res
      .status(500)
      .json({ error: "PAYSTACK_SECRET_KEY not configured" });

  try {
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK}` } },
    );
    const verifyJson = await verifyRes.json();
    if (!verifyJson.status)
      return res
        .status(400)
        .json({ error: "verification failed", details: verifyJson });

    await connectToDatabase();

    // find payment by reference
    let payment = await Payment.findOne({ reference });
    if (!payment) {
      // store it anyway
      payment = new Payment({
        reference,
        status: "verified",
        raw: verifyJson,
        verifiedAt: new Date(),
      });
      await payment.save();
      return res.json({ message: "Payment verified (no local order found)" });
    }

    if (payment.status === "verified")
      return res.json({ message: "Already verified" });

    payment.status = "verified";
    payment.verifiedAt = new Date();
    payment.raw = verifyJson;
    await payment.save();

    // mark order paid
    if (payment.orderId) {
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.status = "paid";
        order.paidAt = new Date();
        order.paymentRef = reference;
        await order.save();
      }
    }

    return res.json({ message: "Payment verified and order marked paid" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
};
