// firebase-init.js
// Importa los módulos de Firebase necesarios desde sus URLs CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuración global de Firebase.
// Estas variables son proporcionadas automáticamente en el entorno Canvas.
// Para pruebas locales, se incluyen valores por defecto.
export const __app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
export const __firebase_config = typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify({
    apiKey: "AIzaSyBELawPeUmP2tRaL19X7Tr6MRcI9oMgdSM",
    authDomain: "channel-jl.firebaseapp.com",
    projectId: "channel-jl",
    storageBucket: "channel-jl.firebasestorage.app",
    messagingSenderId: "350780625607",
    appId: "1:350780625607:web:a0275d6d6ee89b0813a4e2"
});

// Inicializa la aplicación Firebase.
export const firebaseApp = initializeApp(JSON.parse(__firebase_config));
console.log("DEBUG PROFUNDO: Firebase App inicializada:", firebaseApp);

// Obtiene instancias de Auth y Firestore.
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Exporta todas las funciones de Firebase que serán utilizadas en otros módulos.
export {
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    onSnapshot,
    addDoc,
    serverTimestamp,
    orderBy,
    getDocs,
    deleteDoc,
    deleteField
};

// Registro del Service Worker para PWA.
// Nota: Los Service Workers requieren HTTPS o localhost. Fallarán si se ejecutan desde el protocolo file:///.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/channel/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado: ', registration);
            })
            .catch(registrationError => {
                console.log('Fallo el registro del Service Worker: ', registrationError);
            });
    });
}
