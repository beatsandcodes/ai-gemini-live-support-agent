/**
 * FAQ knowledge base for common customer questions.
 * Maps keywords/topics to detailed answers.
 */
const FAQ_DATABASE = {
    return_policy: {
        keywords: ['return', 'return policy', 'send back', 'exchange', 'swap'],
        answer: `Our return policy allows returns within 30 days of delivery. Items must be in their original condition and packaging. To initiate a return, please provide your order number and we'll guide you through the process. Free return shipping is available for defective items.`
    },
    shipping: {
        keywords: ['shipping', 'ship', 'delivery', 'how long', 'delivery time', 'shipping time', 'fast shipping'],
        answer: `We offer the following shipping options:\n• Standard Shipping: 5–7 business days (Free on orders over $50)\n• Express Shipping: 2–3 business days ($9.99)\n• Next-Day Shipping: Next business day ($19.99)\n\nAll orders are processed within 1 business day. You'll receive a tracking number once your order ships.`
    },
    contact: {
        keywords: ['contact', 'email', 'phone', 'support email', 'reach', 'talk to human', 'agent', 'representative'],
        answer: `You can reach our support team through:\n• Email: support@shopease.com\n• Phone: 1-800-SHOP-EZ (1-800-746-7390)\n• Live Chat: Available on our website Mon–Fri, 9 AM – 6 PM EST\n\nOur average response time is under 2 hours during business hours.`
    },
    payment: {
        keywords: ['payment', 'pay', 'credit card', 'debit', 'visa', 'mastercard', 'paypal', 'payment method'],
        answer: `We accept the following payment methods:\n• Visa, Mastercard, American Express, and Discover\n• PayPal\n• Apple Pay and Google Pay\n• ShopEase Gift Cards\n\nAll transactions are secured with 256-bit SSL encryption.`
    },
    warranty: {
        keywords: ['warranty', 'guarantee', 'broken', 'defective', 'damaged', 'not working'],
        answer: `All products come with a standard 1-year manufacturer warranty. If your item is defective or damaged:\n1. Contact us within 30 days for a full replacement\n2. After 30 days, warranty repairs are handled by the manufacturer\n3. We provide free return shipping for all defective items\n\nPlease have your order number ready when contacting us.`
    },
    account: {
        keywords: ['account', 'password', 'login', 'sign in', 'register', 'forgot password'],
        answer: `For account-related issues:\n• Reset your password using the "Forgot Password" link on the login page\n• Check your spam folder for verification emails\n• Make sure you're using the email address you registered with\n\nIf you're still having trouble, contact support@shopease.com with your registered email address.`
    },
    tracking: {
        keywords: ['track', 'tracking', 'where is', 'package', 'lost package', 'missing'],
        answer: `To track your order:\n1. Log in to your ShopEase account\n2. Go to "My Orders"\n3. Click on the order you want to track\n4. You'll see real-time tracking information\n\nAlternatively, use the tracking number from your shipping confirmation email on the carrier's website. If your package appears lost, please contact us and we'll investigate immediately.`
    }
};

/**
 * Answer frequently asked questions about store policies and support.
 * Uses keyword matching to find the most relevant FAQ entry.
 * @param {string} question - The customer's question
 * @returns {object} FAQ answer result
 */
function faq(question) {
    const normalizedQuestion = question.toLowerCase().trim();

    let bestMatch = null;
    let maxScore = 0;

    for (const [topic, entry] of Object.entries(FAQ_DATABASE)) {
        let score = 0;
        for (const keyword of entry.keywords) {
            if (normalizedQuestion.includes(keyword.toLowerCase())) {
                // Longer keyword matches are weighted more heavily
                score += keyword.length;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = { topic, ...entry };
        }
    }

    if (bestMatch && maxScore > 0) {
        return {
            success: true,
            topic: bestMatch.topic,
            message: bestMatch.answer
        };
    }

    return {
        success: false,
        message: `I don't have a specific FAQ entry for that question, but I'd be happy to help! You can:\n• Email us at support@shopease.com for detailed assistance\n• Call 1-800-SHOP-EZ during business hours\n• Try rephrasing your question and I'll do my best to help`
    };
}

module.exports = { faq };
