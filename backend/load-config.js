const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envFilePath =
  process.env.BACKEND_ENV_FILE || "/etc/secrets/backend.env";
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

const configPath =
  process.env.BACKEND_CONFIG_FILE || "/etc/secrets/backend-config.json";

if (fs.existsSync(configPath)) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    throw new Error(`Backend secret config is not valid JSON: ${configPath}`);
  }

  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    !config.firebaseServiceAccount ||
    typeof config.firebaseServiceAccount !== "object" ||
    config.firebaseServiceAccount.type !== "service_account" ||
    typeof config.firebaseServiceAccount.client_email !== "string" ||
    typeof config.firebaseServiceAccount.private_key !== "string"
  ) {
    throw new Error(
      "Backend secret config must include a valid firebaseServiceAccount"
    );
  }
  if (
    typeof config.jwtSecret !== "string" ||
    config.jwtSecret.length < 32
  ) {
    throw new Error("Backend secret config jwtSecret must be at least 32 characters");
  }
  if (
    typeof config.adminPassword !== "string" ||
    config.adminPassword.length < 12
  ) {
    throw new Error("Backend secret config adminPassword must be at least 12 characters");
  }
  for (const key of [
    "razorpayKeyId",
    "razorpayKeySecret",
    "wuapiApiKey",
    "wuapiAccountId",
  ]) {
    if (config[key] !== undefined && typeof config[key] !== "string") {
      throw new Error(`Backend secret config ${key} must be a string`);
    }
  }
  if (
    Boolean(config.razorpayKeyId) !== Boolean(config.razorpayKeySecret) ||
    Boolean(config.wuapiApiKey) !== Boolean(config.wuapiAccountId)
  ) {
    throw new Error(
      "Backend secret config must provide both credentials for Razorpay and Wuapi, or neither"
    );
  }
  if (
    config.frontendOrigins !== undefined &&
    (!Array.isArray(config.frontendOrigins) ||
      config.frontendOrigins.some((origin) => typeof origin !== "string"))
  ) {
    throw new Error("Backend secret config frontendOrigins must be an array of strings");
  }

  process.env.FIREBASE_PROJECT_ID =
    config.firebaseProjectId ||
    config.firebaseServiceAccount.project_id ||
    "dr-vishal-clinic";
  process.env.GOOGLE_APPLICATION_CREDENTIALS = JSON.stringify(
    config.firebaseServiceAccount
  );
  process.env.JWT_SECRET = config.jwtSecret;
  process.env.ADMIN_PASSWORD = config.adminPassword;
  process.env.RAZORPAY_KEY_ID = config.razorpayKeyId || "";
  process.env.RAZORPAY_KEY_SECRET = config.razorpayKeySecret || "";
  process.env.WUAPI_API_KEY = config.wuapiApiKey || "";
  process.env.WUAPI_ACCOUNT_ID = config.wuapiAccountId || "";
  process.env.FRONTEND_ORIGINS = Array.isArray(config.frontendOrigins)
    ? config.frontendOrigins.join(",")
    : "";
} else if (
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim()
) {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON");
  }
  if (
    !serviceAccount ||
    serviceAccount.type !== "service_account" ||
    typeof serviceAccount.client_email !== "string" ||
    typeof serviceAccount.private_key !== "string"
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account credential"
    );
  }
  process.env.FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount.project_id ||
    "dr-vishal-clinic";
  process.env.GOOGLE_APPLICATION_CREDENTIALS =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}

if (process.env.NODE_ENV === "production" && !process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = "dr-vishal-clinic";
}

if (process.env.NODE_ENV === "production") {
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ) {
    throw new Error(
      `Firebase credentials are missing. Add a Render Secret File at ${path.resolve(envFilePath)} containing FIREBASE_SERVICE_ACCOUNT_JSON.`
    );
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be configured with at least 12 characters");
  }
  if (
    Boolean(process.env.RAZORPAY_KEY_ID) !==
    Boolean(process.env.RAZORPAY_KEY_SECRET)
  ) {
    throw new Error(
      "Configure both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or leave both blank"
    );
  }
  if (
    Boolean(process.env.WUAPI_API_KEY) !==
    Boolean(process.env.WUAPI_ACCOUNT_ID)
  ) {
    throw new Error(
      "Configure both WUAPI_API_KEY and WUAPI_ACCOUNT_ID, or leave both blank"
    );
  }
}
