import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBd9ZDOCJymS0dANGwVrlVqy1dxALiUopM",
  authDomain: "sistema-notas-99217.firebaseapp.com",
  projectId: "sistema-notas-99217",
  storageBucket: "sistema-notas-99217.appspot.com", // <- tem que ser .appspot.com
  messagingSenderId: "136826957284",
  appId: "1:136826957284:web:ec9ee2431c0124589c6bf1",
  measurementId: "G-G0104CED3S"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'southamerica-east1');
export default app;
