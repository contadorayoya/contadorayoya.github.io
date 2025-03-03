import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCAshyoEbkhu40kw0WYMg98wDm99B59KZ8",
  authDomain: "cuadernopublico.firebaseapp.com",
  projectId: "cuadernopublico",
  storageBucket: "cuadernopublico.firebasestorage.app",
  messagingSenderId: "48382330347",
  appId: "1:48382330347:web:247499ab1b8489369d85ae",
  measurementId: "G-N7YZG6KB9W"
};
// Inicializa Firebase
const app = initializeApp(firebaseConfig);
 
// Inicializa Firestore
const db = getFirestore(app);

export { db, collection, addDoc };