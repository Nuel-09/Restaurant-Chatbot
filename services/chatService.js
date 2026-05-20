const Device = require("../models/Device");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { MENU } = require("../lib/menu");
const { connectToDatabase } = require("../lib/mongoose");

function formatMenu() {
  return MENU.map(
    (item) =>
      `${item.idx}: ${item.name} - ₦${item.price}\n   ${item.description}`,
  ).join("\n");
}

function formatOptions(item) {
  if (!item.options || item.options.length === 0) {
    return 'No options for this item. Send "add" to add to cart or "1" to go back to menu.';
  }

  let message = `Options for ${item.name}:\n`;
  item.options.forEach((option) => {
    message += `\n${option.name}:\n`;
    option.choices.forEach((choice) => {
      message += `  ${choice.id}: ${choice.name}`;
      if (choice.extra) message += ` (+₦${choice.extra})`;
      message += "\n";
    });
  });
  message +=
    '\nSend option choices (e.g. "s" for small) or "add" to add to cart.';
  return message;
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
    { deviceId, status: { $in: ["draft", "placed", "scheduled"] } },
    {},
    { sort: { createdAt: -1 } },
  );
}

async function ensureOrder(deviceId) {
  let order = await getCurrentOrder(deviceId);
  if (!order) {
    order = new Order({
      deviceId,
      items: [],
      status: "draft",
      total: 0,
    });
  }
  return order;
}

async function createPayment(order, baseUrl) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: { error: "PAYSTACK_SECRET_KEY not configured" },
    };
  }

  const reference = `ORD_${order._id.toString()}_${Date.now()}`;
  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "customer@example.com",
        amount: order.total * 100,
        reference,
        callback_url: `${baseUrl}/`,
        metadata: {
          orderId: order._id.toString(),
          deviceId: order.deviceId,
        },
      }),
    },
  );

  const json = await response.json();
  if (!json.status) {
    return {
      statusCode: 502,
      body: { error: "Paystack init failed", details: json },
    };
  }

  const payment = new Payment({
    orderId: order._id,
    reference: json.data.reference,
    status: "initiated",
    amount: order.total,
    raw: json,
  });
  await payment.save();

  order.status = "placed";
  order.updatedAt = new Date();
  await order.save();

  return {
    statusCode: 200,
    body: {
      message: "Redirect to payment",
      authorization_url: json.data.authorization_url,
      reference: json.data.reference,
    },
  };
}

async function handleChatCommand({
  deviceId,
  input,
  tempSelections = {},
  baseUrl,
}) {
  if (!deviceId) {
    return { statusCode: 400, body: { error: "deviceId required" } };
  }

  const device = await findOrCreateDevice(deviceId);
  const trimmed = String(input || "").trim();

  if (trimmed === "" || trimmed.toLowerCase() === "help") {
    return {
      statusCode: 200,
      body: {
        message:
          "Welcome!\nSend:\n1 - Place an order\n99 - Checkout\n98 - Order history\n97 - Current order\n0 - Cancel order",
      },
    };
  }

  if (trimmed === "1") {
    return {
      statusCode: 200,
      body: {
        message: `Menu:\n${formatMenu()}\n\nReply with item number (e.g. 10) to select.`,
      },
    };
  }

  if (trimmed === "97") {
    const order = await getCurrentOrder(device.deviceId);
    if (!order)
      return { statusCode: 200, body: { message: "No current order." } };

    const itemList = order.items
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} x${item.qty} - ₦${item.total}`,
      )
      .join("\n");

    return {
      statusCode: 200,
      body: { message: `Current order:\n${itemList}\nTotal: ₦${order.total}` },
    };
  }

  if (trimmed === "98") {
    const orders = await Order.find(
      {
        deviceId: device.deviceId,
        status: { $in: ["paid", "placed", "cancelled", "scheduled"] },
      },
      {},
      { sort: { createdAt: -1 }, limit: 20 },
    );

    if (!orders.length)
      return { statusCode: 200, body: { message: "No past orders." } };

    const list = orders
      .map(
        (order) =>
          `${order._id.toString()} - ${order.status} - ₦${order.total} - ${new Date(order.createdAt).toLocaleString()}`,
      )
      .join("\n");

    return { statusCode: 200, body: { message: `Order history:\n${list}` } };
  }

  if (trimmed === "0") {
    const order = await getCurrentOrder(device.deviceId);
    if (!order)
      return { statusCode: 200, body: { message: "No order to cancel." } };

    order.status = "cancelled";
    order.updatedAt = new Date();
    await order.save();

    return { statusCode: 200, body: { message: "Order cancelled." } };
  }

  if (trimmed === "99") {
    const order = await getCurrentOrder(device.deviceId);
    if (!order || !order.items || !order.items.length) {
      return { statusCode: 200, body: { message: "No order to place." } };
    }

    return createPayment(order, baseUrl);
  }

  if (trimmed.startsWith("schedule:")) {
    const order = await getCurrentOrder(device.deviceId);
    if (!order || !order.items.length) {
      return { statusCode: 200, body: { message: "No order to schedule." } };
    }

    const timeText = trimmed.slice("schedule:".length).trim();
    const scheduledTime = new Date(timeText);
    if (Number.isNaN(scheduledTime.getTime())) {
      return {
        statusCode: 200,
        body: {
          message:
            "Invalid time format. Use ISO 8601 (e.g. 2026-05-20T14:30:00)",
        },
      };
    }

    order.scheduledAt = scheduledTime;
    order.status = "scheduled";
    order.updatedAt = new Date();
    await order.save();

    return {
      statusCode: 200,
      body: {
        message: `Order scheduled for ${scheduledTime.toLocaleString()}. Reply 99 to proceed to payment.`,
      },
    };
  }

  const asNumber = parseInt(trimmed, 10);
  const menuItem = MENU.find((item) => item.idx === asNumber);

  if (menuItem) {
    if (menuItem.options && menuItem.options.length > 0) {
      return {
        statusCode: 200,
        body: {
          message: formatOptions(menuItem),
          selectingItem: menuItem.idx,
          options: menuItem.options,
        },
      };
    }

    const order = await ensureOrder(device.deviceId);
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

    return {
      statusCode: 200,
      body: {
        message: `${menuItem.name} added to order. Reply 99 to checkout or 1 for more items.`,
      },
    };
  }

  if (tempSelections?.selectingItem) {
    const item = MENU.find(
      (menuEntry) => menuEntry.idx === tempSelections.selectingItem,
    );
    if (item) {
      const order = await ensureOrder(device.deviceId);
      const selectedOptions = {};
      let extraCost = 0;

      if (item.options) {
        item.options.forEach((option) => {
          const chosenChoice = option.choices.find(
            (choice) => choice.id === trimmed,
          );
          if (chosenChoice) {
            selectedOptions[option.id] = chosenChoice.id;
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

      return {
        statusCode: 200,
        body: {
          message: `${item.name} added to order. Reply 99 to checkout or 1 for more items.`,
        },
      };
    }
  }

  return {
    statusCode: 200,
    body: {
      message:
        "Sorry, I did not understand that input. Send 1 for menu, 99 to checkout, 98 for history, 97 for current order, or 0 to cancel.",
    },
  };
}

module.exports = {
  handleChatCommand,
  findOrCreateDevice,
  getCurrentOrder,
};
