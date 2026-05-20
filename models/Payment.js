const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: mongoose.Schema.Types.ObjectId,
  provider: { type: String, default: "paystack" },
  reference: { type: String, unique: true, required: true, index: true },
  status: {
    type: String,
    enum: ["initiated", "pending", "verified", "failed"],
    default: "initiated",
  },
  amount: Number,
  raw: mongoose.Schema.Types.Mixed,
  verifiedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
