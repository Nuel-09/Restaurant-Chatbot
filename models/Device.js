const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, required: true, index: true },
  currentOrderId: mongoose.Schema.Types.ObjectId,
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.Device || mongoose.model("Device", deviceSchema);
