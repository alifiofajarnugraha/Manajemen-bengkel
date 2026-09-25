import { auth } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    
    if (!user && !isLoginPage) {
        // Jika belum login dan bukan di halaman login, pindahkan ke login.html
        window.location.replace('login.html');
    } else if (user && isLoginPage) {
        // Jika sudah login tapi sedang di halaman login, pindahkan ke dashboard
        window.location.replace('index.html');
    }
});

// Fungsi logout dipasang ke objek window agar bisa dipanggil dari HTML onclick
window.logout = function() {
    signOut(auth).then(() => {
        window.location.replace('login.html');
    }).catch(error => {
        alert("Gagal logout: " + error.message);
    });
};
