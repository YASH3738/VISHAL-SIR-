process.env.FIREBASE_FUNCTIONS = "true";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const app = require("./api");

const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const pinEncryptionKey = defineSecret("PIN_ENCRYPTION_KEY");
const secrets = [
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  pinEncryptionKey,
];

exports.api = onRequest(
  {
    region: "asia-south1",
    secrets,
    maxInstances: 10,
  },
  (request, response) => {
    process.env.RAZORPAY_KEY_ID = razorpayKeyId.value();
    process.env.RAZORPAY_KEY_SECRET = razorpayKeySecret.value();
    process.env.RAZORPAY_WEBHOOK_SECRET = razorpayWebhookSecret.value();
    process.env.PIN_ENCRYPTION_KEY = pinEncryptionKey.value();
    app(request, response);
  }
);
