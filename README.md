# TriUsaha – Sistem Manajemen Bengkel, Steam & Fotocopy

> **© AFN** | Powered by Firebase Firestore

Aplikasi manajemen usaha berbasis web yang mencakup tiga lini bisnis sekaligus: **Bengkel Kendaraan**, **Cuci Steam**, dan **Fotocopy & ATK**. Dibangun dengan tampilan modern, responsif di HP maupun laptop, dan dirancang agar mudah digunakan oleh siapa saja — termasuk yang kurang familiar dengan teknologi.

---

## 🚀 Fitur Utama

### 1. 📊 Dashboard (`index.html`)
- Kartu ringkasan: **Untung Bengkel**, **Gaji Tukang Bengkel**, **Gaji Tukang Steam**, **Total Pengeluaran**, **Untung Fotocopy**
- **Grafik batang harian** — Keuntungan & gaji per hari (4 dataset: Untung Sparepart, Gaji Bengkel, Gaji Steam, Untung Fotocopy)
- **Filter tanggal** — tampilkan data sesuai rentang yang dipilih
- **Export ke Excel** — unduh laporan lengkap (.xlsx)
- **Reset riwayat** — hapus semua transaksi dengan konfirmasi
- **Quick link** ke halaman Kasir, Inventori, dan Fotocopy
- Notifikasi stok rendah (barang yang stoknya < 5)

### 2. 🔧 Kasir Bengkel & Steam (`pos.html`)
- Alur **3 langkah** yang sangat jelas (Pilih Pekerja → Pilih Barang/Jasa → Bayar)
- **Worker card visual** — klik gambar untuk pilih tukang bengkel atau steam, bukan dropdown
- Pilih spare part dari inventori atau masukkan biaya jasa saja
- Mode **steam**: input jumlah kendaraan, harga otomatis dihitung (Rp 10.000/kendaraan, gaji Rp 5.000/kendaraan)
- Keranjang belanja dengan total otomatis
- Riwayat transaksi hari ini di panel samping

### 3. 📦 Inventori Bengkel (`inventory.html`)
- Tambah, edit, dan hapus stok barang (oli, spare part, aksesoris steam, dll.)
- Form lengkap: **nama, kategori, harga beli (modal), harga jual, stok**
- Stok **hampir habis (< 5)** ditandai warna merah + peringatan ⚠
- Estimasi keuntungan per item dihitung otomatis
- Penambahan stok otomatis mencatat ke **Riwayat Pengeluaran / Restock**

### 4. 🖨️ Fotocopy & ATK (`fotocopy.html`)
- **Tab terpisah**: Kasir | Stok Barang | Semua Riwayat
- **Kasir fotocopy** dengan keranjang multi-item
- Pilih dari stok atau input **jasa manual** (nama + harga bebas)
- Fitur **Diskon** dengan 2 mode:
  - **% Persen** — contoh: diskon 10% dari subtotal
  - **Rp Nominal** — contoh: diskon tepat Rp 5.000
  - Preview langsung sebelum checkout
- Stok otomatis berkurang setelah transaksi
- Stok kategori: Kertas, ATK, Tinta/Toner, Jilid, Map, dll.
- **Export Excel** dan **Reset riwayat** transaksi fotocopy

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Fungsi |
|---|---|
| HTML5 + CSS3 | Struktur & tampilan halaman |
| JavaScript (ES6 Modules) | Logika aplikasi |
| [Tailwind CSS](https://tailwindcss.com/) (CDN) | Utility CSS tambahan |
| [Chart.js v4.4.3](https://www.chartjs.org/) (CDN) | Grafik batang di dashboard |
| [SheetJS (XLSX)](https://sheetjs.com/) (CDN) | Export laporan ke Excel |
| [Font Awesome 6](https://fontawesome.com/) (CDN) | Ikon antarmuka |
| [Google Fonts – Plus Jakarta Sans](https://fonts.google.com/) | Tipografi |
| **Firebase Firestore** | Database cloud real-time (NoSQL) |

---

## 🗄️ Database – Firebase Firestore

Aplikasi menggunakan **Firebase Firestore** (Cloud NoSQL Database dari Google).

**Cara kerja:**
- **Real-time sync**: Menggunakan `onSnapshot` — setiap perubahan data langsung tampil tanpa reload
- **Client-side**: Semua operasi database dikelola dari JavaScript (`js/app.js` dan `js/fotocopy.js`)
- **Tidak perlu setup manual**: Firestore otomatis membuat koleksi baru saat pertama kali data ditulis

**Struktur koleksi (Collections):**

| Koleksi | Isi |
|---|---|
| `inventory` | Stok barang bengkel (nama, kategori, harga beli, harga jual, stok) |
| `transactions` | Riwayat transaksi kasir bengkel & steam |
| `expenses` | Pengeluaran/restock inventori bengkel |
| `fotocopy_inventory` | Stok barang fotocopy & ATK |
| `fotocopy_transactions` | Riwayat transaksi fotocopy (termasuk diskon & keuntungan bersih) |
| `fotocopy_expenses` | Pengeluaran/restock fotocopy |

---

## 💻 Cara Menjalankan Aplikasi

> ⚠️ **Penting:** Aplikasi menggunakan ES Modules (`type="module"`), sehingga **tidak bisa dibuka langsung** dengan klik ganda file `.html`. Harus dijalankan melalui **local server**.

### Opsi 1: VS Code Live Server *(Paling Mudah)*
1. Buka folder proyek di **Visual Studio Code**
2. Install ekstensi **Live Server** (jika belum ada)
3. Klik kanan `index.html` → **"Open with Live Server"** (atau klik **"Go Live"** di status bar bawah)
4. Aplikasi terbuka otomatis di browser

### Opsi 2: Node.js (`npx`)
```bash
npx http-server
# atau
npx serve
```
Kemudian buka URL localhost yang muncul di terminal.

### Opsi 3: Python
```bash
python -m http.server 8000
```
Buka `http://localhost:8000` di browser.

---

## 📁 Struktur File

```
PROJEK MANAJEMEN BENGKEL/
├── index.html          # Dashboard laporan
├── pos.html            # Kasir Bengkel & Steam
├── inventory.html      # Inventori Bengkel
├── fotocopy.html       # Kasir & Stok Fotocopy
├── js/
│   ├── app.js          # Logika bengkel, steam, dashboard (Firebase)
│   └── fotocopy.js     # Logika fotocopy (Firebase)
└── README.md
```

---

## 🔒 Catatan Keamanan Firebase

Pastikan **Firestore Security Rules** Anda mengizinkan akses ke semua koleksi. Untuk development/testing gunakan:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Untuk produksi/publik, sebaiknya tambahkan autentikasi Firebase agar data lebih aman.

---

*© AFN – TriUsaha v2.0 | Dibuat untuk memudahkan pengelolaan usaha Bengkel, Steam, dan Fotocopy.*
