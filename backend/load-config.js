const fs = require("fs");
const path = require("path");

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
} else if (process.env.NODE_ENV === "production") {
  throw new Error(
    `Backend secret config file is missing: ${path.resolve(configPath)}. Add it as a Render Secret File.`
  );
}
