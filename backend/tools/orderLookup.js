const path = require('path');
const fs = require('fs');

// Load orders data
const ordersPath = path.join(__dirname, '..', 'data', 'orders.json');
let orders = {};

try {
  const rawData = fs.readFileSync(ordersPath, 'utf-8');
  orders = JSON.parse(rawData);
} catch (error) {
  console.error('Failed to load orders data:', error.message);
}

/**
 * Look up the status of a customer order by order ID.
 * @param {string} orderId - The order ID to look up
 * @returns {object} Order status information
 */
function checkOrder(orderId) {
  const id = String(orderId).trim();
  const order = orders[id];

  if (!order) {
    return {
      success: false,
      message: `Sorry, I couldn't find an order with ID ${id}. Please double-check the order number and try again.`
    };
  }

  let message = `Here's the status of your order #${id}:\n`;
  message += `• Status: ${order.status}\n`;
  message += `• Items: ${order.items.join(', ')}\n`;
  message += `• Total: ${order.total}\n`;

  if (order.status === 'Shipped') {
    message += `• Estimated Delivery: ${order.estimated_delivery}\n`;
    message += `• Tracking Number: ${order.tracking_number}`;
  } else if (order.status === 'Delivered') {
    message += `• ${order.estimated_delivery}`;
  } else if (order.status === 'Processing') {
    message += `• Estimated Delivery: ${order.estimated_delivery}\n`;
    message += `• Your order is being prepared and will ship soon.`;
  } else if (order.status === 'Cancelled') {
    message += `• This order has been cancelled.`;
  }

  return {
    success: true,
    order_id: id,
    status: order.status,
    message: message
  };
}

module.exports = { checkOrder };
