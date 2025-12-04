// Importar funciones SDK v9+
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyDaoagR8WKivF-oMqYcgGyk9-PCZCcT-UA",
    authDomain: "metodologia-de-analisis.firebaseapp.com",
    projectId: "metodologia-de-analisis",
    storageBucket: "metodologia-de-analisis.firebasestorage.app",
    messagingSenderId: "943122788282",
    appId: "1:943122788282:web:055377ce556a81c7953783",
    measurementId: "G-VCZEM0BKF0"
  };
// Inicializar
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// 2. Exportamos la instancia de Auth
export const auth = getAuth(app);