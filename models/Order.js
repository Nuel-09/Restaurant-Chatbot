const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  items: [
    {
      menuId: Number,
      name: String,
      qty: Number,
      unitPrice: Number,
      selectedOptions: { type: Object, default: {} },
      total: Number,
    },
  ],
  status: {
    type: String,
    enum: ["draft", "placed", "paid", "cancelled", "scheduled"],
    default: "draft",
  },
  total: { type: Number, default: 0 },
  scheduledAt: Date,
  paymentRef: String,
  paidAt: Date,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
