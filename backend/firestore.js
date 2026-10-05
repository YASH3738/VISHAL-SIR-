const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fromWorkingDirectory = path.resolve(configuredPath);
  const fromBackendDirectory = path.resolve(__dirname, configuredPath);
  const resolvedPath = fs.existsSync(fromWorkingDirectory)
    ? fromWorkingDirectory
    : fromBackendDirectory;
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Google application credentials file was not found: ${configuredPath}`
    );
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
} else if (fs.existsSync(path.join(__dirname, "firebase-service-account.json"))) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    __dirname,
    "firebase-service-account.json"
  );
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || "dr-vishal-clinic",
});

const db = getFirestore(app);

const collections = {
  patients: db.collection("patients"),
  credentials: db.collection("patient_credentials"),
  bookings: db.collection("appointment_bookings"),
  appointments: db.collection("appointments"),
  treatments: db.collection("treatments"),
  payments: db.collection("payments"),
};

function serialize(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)])
    );
  }
  return value;
}

function documentData(snapshot) {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...serialize(snapshot.data()) };
}

async function getByField(collection, field, value) {
  const snapshot = await collections[collection]
    .where(field, "==", value)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function getByFieldValues(collection, field, values) {
  const documents = [];
  for (let index = 0; index < values.length; index += 30) {
    const chunk = values.slice(index, index + 30);
    const snapshot = await collections[collection]
      .where(field, "in", chunk)
      .get();
    documents.push(...snapshot.docs);
  }
  return documents;
}

module.exports = {
  FieldValue,
  collections,
  db,
  documentData,
  getByField,
  getByFieldValues,
  serialize,
};
