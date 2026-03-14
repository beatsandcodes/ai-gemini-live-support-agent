const path = require('path');
const fs = require('fs');

// Load orders data to validate order IDs
const ordersPath = path.join(__dirname, '..', 'data', 'orders.json');
let orders = {};

try {
    const rawData = fs.readFileSync(ordersPath, 'utf-8');
    orders = JSON.parse(rawData);
} catch (error) {
    console.error('Failed to load orders data:', error.message);
}

/**
 * Process a refund request for a customer order.
 * @param {string} orderId - The order ID to refund
 * @returns {object} Refund processing result
 */
function processRefund(orderId) {
    const id = String(orderId).trim();
    const order = orders[id];

    if (!order) {
        return {
            success: false,
            message: `I couldn't find order #${id}. Please verify the order number and try again.`
        };
    }

    if (order.status === 'Cancelled') {
        return {
            success: false,
            message: `Order #${id} has already been cancelled. If you were charged, the refund should already be in progress. Please allow 5–7 business days for it to appear on your statement.`
        };
    }

    // Simulate refund processing
    const refundAmount = order.total;
    const refundId = `RFD-${Date.now().toString(36).toUpperCase()}`;

    return {
        success: true,
        order_id: id,
        refund_id: refundId,
        refund_amount: refundAmount,
        message: `Your refund request for order #${id} has been submitted successfully!\n• Refund ID: ${refundId}\n• Refund Amount: ${refundAmount}\n• The refund will be processed within 3–5 business days and credited back to your original payment method.`
    };
}

module.exports = { processRefund };
