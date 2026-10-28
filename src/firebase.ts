import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyApifDrGuoHFtdU1ZZtPRUWvkFgjMFyCEY",
  authDomain: "ya-zadolbalcya.firebaseapp.com",
  databaseURL: "https://ya-zadolbalcya-default-rtdb.firebaseio.com",
  projectId: "ya-zadolbalcya",
  storageBucket: "ya-zadolbalcya.firebasestorage.app",
  messagingSenderId: "736550801988",
  appId: "1:736550801988:web:69815bbb50bb799b296211",
  measurementId: "G-ZEPE6548CN"
};

// Initialize Firebase once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
