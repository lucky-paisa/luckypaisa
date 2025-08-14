// src/firebase.js

// Import Firebase core and needed services
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase config — keep this safe!
const firebaseConfig = {
  apiKey: "AIzaSyA8IF4ltR8kUXnuaTfKEU9sPeouJppuJeM",
  authDomain: "lucky-paisa-f6f1e.firebaseapp.com",
  projectId: "lucky-paisa-f6f1e",
  storageBucket: "lucky-paisa-f6f1e.appspot.com",
  messagingSenderId: "60995613666",
  appId: "1:60995613666:web:96ca76c1a2b90897fe3fbb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { setLogLevel } from "firebase/firestore";
setLogLevel('error');

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
