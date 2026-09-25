import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBu9L9cU8uIQiVQLDUxQR1oiac8oOZH17A",
    authDomain: "projek-manajemen-bengkel.firebaseapp.com",
    projectId: "projek-manajemen-bengkel",
    storageBucket: "projek-manajemen-bengkel.firebasestorage.app",
    messagingSenderId: "612604542103",
    appId: "1:612604542103:web:63794823d37c13e43bfdd2",
    measurementId: "G-ZX2QBQ67MR"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
