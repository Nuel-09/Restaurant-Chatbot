const { connectToDatabase } = require("../../../lib/mongoose");
const Device = require("../../../models/Device");
const Order = require("../../../models/Order");
const Payment = require("../../../models/Payment");
const { MENU } = require("../../../lib/menu");
const fetch = global.fetch || require("node-fetch");

function formatMenu() {
  return MENU.map(
    (item) =>
      `${item.idx}: ${item.name} - ₦${item.price} \n   ${item.description}`,
  ).join("\n");
}

function formatOptions(item) {
  if (!item.options || item.options.length === 0) {
    return `No options for this item. Send "add" to add to cart or "1" to go back to menu.`;
  }

  let msg = `Options for ${item.name}:\n`;
  item.options.forEach((opt) => {
    msg += `\n${opt.name}:\n`;
    opt.choices.forEach((choice) => {
      msg += `  ${choice.id}: ${choice.name}`;
      if (choice.extra) msg += ` (+₦${choice.extra})`;
      msg += "\n";
    });
  });
  msg += '\nSend option choices (e.g., "s" for small) or "add" to add to cart.';
  return msg;
}

async function findOrCreateDevice(deviceId) {
  await connectToDatabase();
  let device = await Device.findOne({ deviceId });
  if (!device) {
    device = new Device({ deviceId, lastSeen: new Date() });
    await device.save();
  } else {
    device.lastSeen = new Date();
    await device.save();
  }
  return device;
}

async function getCurrentOrder(deviceId) {
  return Order.findOne(
    { deviceId, status: { $in: ["draft", "placed"] } },
    {},
    { sort: { createdAt: -1 } },
  );
}

module.exports = async function handler(req, res) {
  const { method } = req;
  if (method !== "POST") return res.status(405).end();

  const { deviceId, input, tempSelections } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  try {
    const device = await findOrCreateDevice(deviceId);
    const trimmed = String(input || "").trim();

    // Help/Welcome
    if (trimmed === "" || trimmed.toLowerCase() === "help") {
      return res.json({
        message:
          "Welcome!\nSend:\n1 - Place an order\n99 - Checkout\n98 - Order history\n97 - Current order\n0 - Cancel order",
      });
    }

    // Menu
    if (trimmed === "1") {
      return res.json({
        message: `Menu:\n${formatMenu()}\n\nReply with item number (e.g., 10) to select.`,
      });
    }

    // Current order
    if (trimmed === "97") {
      const order = await getCurrentOrder(device.deviceId);
      if (!order) return res.json({ message: "No current order." });
      const itemList = order.items
        .map((it, i) => `${i + 1}. ${it.name} x${it.qty} - ₦${it.total}`)
        .join("\n");
      return res.json({
        message: `Current order:\n${itemList}\nTotal: ₦${order.total}`,
      });
    }

    // Order history
    if (trimmed === "98") {
      const orders = await Order.find(
        {
          deviceId: device.deviceId,
          status: { $in: ["paid", "placed", "cancelled", "scheduled"] },
        },
        {},
        { sort: { createdAt: -1 }, limit: 20 },
      );
      if (!orders.length) return res.json({ message: "No past orders." });
      const list = orders
        .map(
          (o) =>
            `${o._id.toString()} - ${o.status} - ₦${o.total} - ${new Date(o.createdAt).toLocaleString()}`,
        )
        .join("\n");
      return res.json({ message: `Order history:\n${list}` });
    }

    // Cancel order
    if (trimmed === "0") {
      const order = await getCurrentOrder(device.deviceId);
      if (!order) return res.json({ message: "No order to cancel." });
      order.status = "cancelled";
      order.updatedAt = new Date();
      await order.save();
      return res.json({ message: "Order cancelled." });
    }

    // Checkout
    if (trimmed === "99") {
      const order = await getCurrentOrder(device.deviceId);
      if (!order || !order.items || !order.items.length)
        return res.json({ message: "No order to place." });

      const PAYSTACK = process.env.PAYSTACK_SECRET_KEY;
      if (!PAYSTACK)
        return res
          .status(500)
          .json({ error: "PAYSTACK_SECRET_KEY not configured" });

      const initRes = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "customer@example.com",
            amount: order.total * 100,
            reference: `ORD_${order._id.toString()}_${Date.now()}`,
          }),
        },
      );
      const initJson = await initRes.json();
      if (!initJson.status)
        return res
          .status(502)
          .json({ error: "Paystack init failed", details: initJson });

      const payment = new Payment({
        orderId: order._id,
        reference: initJson.data.reference,
        status: "initiated",
        amount: order.total,
        raw: initJson,
      });
      await payment.save();

      order.status = "placed";
      order.updatedAt = new Date();
      await order.save();

      return res.json({
        message: "Redirect to payment",
        authorization_url: initJson.data.authorization_url,
        reference: initJson.data.reference,
      });
    }

    // Schedule order
    if (trimmed.startsWith("schedule:")) {
      const order = await getCurrentOrder(device.deviceId);
      if (!order || !order.items.length)
        return res.json({ message: "No order to schedule." });

      const timeStr = trimmed.slice(9).trim();
      const scheduledTime = new Date(timeStr);
      if (isNaN(scheduledTime.getTime()))
        return res.json({
          message:
            "Invalid time format. Use ISO 8601 (e.g., 2026-05-20T14:30:00)",
        });

      order.scheduledAt = scheduledTime;
      order.status = "scheduled";
      order.updatedAt = new Date();
      await order.save();
      return res.json({
        message: `Order scheduled for ${scheduledTime.toLocaleString()}. Reply 99 to proceed to payment.`,
      });
    }

    // Item selection with options
    const asNum = parseInt(trimmed, 10);
    const menuItem = MENU.find((m) => m.idx === asNum);

    if (menuItem) {
      if (menuItem.options && menuItem.options.length > 0) {
        return res.json({
          message: formatOptions(menuItem),
          selectingItem: menuItem.idx,
        });
      } else {
        // No options, add directly
        let order = await getCurrentOrder(device.deviceId);
        if (!order) {
          order = new Order({
            deviceId: device.deviceId,
            items: [],
            status: "draft",
            total: 0,
          });
        }

        const itemTotal = menuItem.price;
        order.items.push({
          menuId: menuItem.idx,
          name: menuItem.name,
          qty: 1,
          unitPrice: menuItem.price,
          selectedOptions: {},
          total: itemTotal,
        });
        order.total += itemTotal;
        order.updatedAt = new Date();
        await order.save();

        return res.json({
          message: `${menuItem.name} added to order. Reply 99 to checkout or 1 for more items.`,
        });
      }
    }

    // If selectingItem is in the request, handle option selection
    if (tempSelections?.selectingItem) {
      const item = MENU.find((m) => m.idx === tempSelections.selectingItem);
      if (item) {
        let order = await getCurrentOrder(device.deviceId);
        if (!order) {
          order = new Order({
            deviceId: device.deviceId,
            items: [],
            status: "draft",
            total: 0,
          });
        }

        // Parse selected options
        const selectedOptions = {};
        let extraCost = 0;
        if (item.options) {
          item.options.forEach((opt) => {
            const chosenChoice = opt.choices.find((c) => c.id === trimmed);
            if (chosenChoice) {
              selectedOptions[opt.id] = chosenChoice.id;
              extraCost += chosenChoice.extra || 0;
            }
          });
        }

        const itemTotal = item.price + extraCost;
        order.items.push({
          menuId: item.idx,
          name: item.name,
          qty: 1,
          unitPrice: item.price + extraCost,
          selectedOptions,
          total: itemTotal,
        });
        order.total += itemTotal;
        order.updatedAt = new Date();
        await order.save();

        return res.json({
          message: `${item.name} added to order. Reply 99 to checkout or 1 for more items.`,
        });
      }
    }

    return res.json({
      message:
        "Sorry, I did not understand that input. Send 1 for menu, 99 to checkout, 98 for history, 97 for current order, or 0 to cancel.",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
};
