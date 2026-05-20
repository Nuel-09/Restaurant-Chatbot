const crypto = require("crypto");
const express = require("express");
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { connectToDatabase } = require("../lib/mongoose");

const router = express.Router();

router.get("/verify", async (req, res) => {
  const { reference } = req.query;
  if (!reference) {
    return res.status(400).json({ error: "reference required" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res
      .status(500)
      .json({ error: "PAYSTACK_SECRET_KEY not configured" });
  }

  try {
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const verifyJson = await verifyRes.json();

    if (!verifyJson.status) {
      return res
        .status(400)
        .json({ error: "verification failed", details: verifyJson });
    }

    await connectToDatabase();

    let payment = await Payment.findOne({ reference });
    if (!payment) {
      payment = new Payment({
        reference,
        status: "verified",
        raw: verifyJson,
        verifiedAt: new Date(),
      });
      await payment.save();
      return res.json({ message: "Payment verified (no local order found)" });
    }

    if (payment.status === "verified") {
      return res.json({ message: "Already verified" });
    }

    payment.status = "verified";
    payment.verifiedAt = new Date();
    payment.raw = verifyJson;
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

    return res.json({ message: "Payment verified and order marked paid" });
  } catch (error) {
    console.error("Verify route error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res
        .status(500)
        .json({ error: "PAYSTACK_SECRET_KEY not configured" });
    }

    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body || "");
      const signature = crypto
        .createHmac("sha512", secretKey)
        .update(rawBody)
        .digest("hex");

      if (signature !== req.headers["x-paystack-signature"]) {
        return res.status(401).json({ error: "Invalid signature" });
      }

      const payload = JSON.parse(rawBody.toString("utf8"));
      const { event, data } = payload;

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
    } catch (error) {
      console.error("Webhook route error:", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

module.exports = router;
