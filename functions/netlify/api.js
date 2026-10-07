process.env.FIREBASE_FUNCTIONS = "true";

const serverless = require("serverless-http");
const app = require("../api");
const expressHandler = serverless(app);
const functionPrefix = "/.netlify/functions/api";

exports.handler = async (event, context) => {
  const path = event.path.startsWith(functionPrefix)
    ? event.path.slice(functionPrefix.length) || "/"
    : event.path;
  return expressHandler({ ...event, path }, context);
};
