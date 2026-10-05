import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyADXH6kJl8PzmHto06Cng_sWnMQ1vrYnMU",
  authDomain: "dr-vishal-clinic.firebaseapp.com",
  projectId: "dr-vishal-clinic",
  storageBucket: "dr-vishal-clinic.firebasestorage.app",
  messagingSenderId: "762874169381",
  appId: "1:762874169381:web:aeb8a688788789f78857cc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

console.log("Firebase Firestore Connected Successfully");
