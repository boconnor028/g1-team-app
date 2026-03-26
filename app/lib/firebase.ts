
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyA9H6qB2RLJBDTq6oLiE8vK8UShVfgPTNQ",
  authDomain: "g1-app-f5b9a.firebaseapp.com",
  projectId: "g1-app-f5b9a",
  storageBucket: "g1-app-f5b9a.firebasestorage.app",
  messagingSenderId: "305327117640",
  appId: "1:305327117640:web:9918bc55b76123f9958f7d",
  measurementId: "G-ZGD3ZRCQ6P"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);