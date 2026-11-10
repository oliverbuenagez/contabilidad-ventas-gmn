// Conexión y exportación de Firebase Firestore modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
  getFirestore,
  initializeFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6JRknzAVNgUlmJ6zGbnnD4jmPKGlvyzo",
  authDomain: "new-prototype-g5ejt.firebaseapp.com",
  projectId: "new-prototype-g5ejt",
  storageBucket: "new-prototype-g5ejt.firebasestorage.app",
  messagingSenderId: "1003940531540",
  appId: "1:1003940531540:web:29eda36e7b15721446ccc1"
};

const app = initializeApp(firebaseConfig);

// Usamos initializeFirestore con auto-detección de long polling para evitar bloqueos de WebChannel/proxies
let db;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  });
} catch (e) {
  db = getFirestore(app);
}

export { 
  db, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp 
};
