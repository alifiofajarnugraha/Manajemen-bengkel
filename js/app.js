import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyBu9L9cU8uIQiVQLDUxQR1oiac8oOZH17A",
  authDomain: "projek-manajemen-bengkel.firebaseapp.com",
  projectId: "projek-manajemen-bengkel",
  storageBucket: "projek-manajemen-bengkel.firebasestorage.app",
  messagingSenderId: "612604542103",
  appId: "1:612604542103:web:63794823d37c13e43bfdd2",
  measurementId: "G-ZX2QBQ67MR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// State Management
function getCurrentDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // Format YYYY-MM-DD
}

let state = {
    inventory: [],
    transactions: [], // { date, worker, item, itemCode, sellPrice, buyPrice, serviceFee, total }
    workers: [
        { id: 'mechanic', name: 'Bapak A (Bengkel)', salaryToday: 0 },
        { id: 'steam', name: 'Bapak B (Steam)', salaryToday: 0 }
    ],
    lastUpdated: getCurrentDateString()
};

async function loadStateFirebase() {
     // Listen to inventory changes
    onSnapshot(collection(db, "inventory"), (querySnapshot) => {
        state.inventory = [];
        querySnapshot.forEach((doc) => {
             state.inventory.push({ id: doc.id, ...doc.data() });
        });
        
        renderDashboard();
        renderInventory();
    });

    // Listen to transaction changes
    onSnapshot(collection(db, "transactions"), (querySnapshot) => {
        state.transactions = [];
        let todaySalaries = { 'mechanic': 0, 'steam': 0 };
        const todayStr = getCurrentDateString();

        querySnapshot.forEach((doc) => {
             const t = { id: doc.id, ...doc.data() };
             state.transactions.push(t);

             // Calculate today's salary
             if (t.date.startsWith(todayStr)) {
                if (todaySalaries[t.workerId] !== undefined) {
                     todaySalaries[t.workerId] += parseFloat(t.serviceFee);
                }
             }
        });
        
        // Update workers salary
        state.workers.forEach(w => {
           w.salaryToday = todaySalaries[w.id] || 0;
        });

        renderDashboard();
        renderHistory();
    });
}

function renderFormatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
}

// ----------------------------------------------------
// UI Renderers
// ----------------------------------------------------

let dashboardChartInstance = null;

function applyDateFilter() {
    renderDashboard();
}

function renderDashboard() {
    const elProfit = document.getElementById('daily-profit');
    const elMechanic = document.getElementById('salary-mechanic');
    const elSteam = document.getElementById('salary-steam');
    const elNotifications = document.getElementById('notification-area');

    if (!elProfit) return; // Not on dashboard page

    // Get filter dates
    const inputStart = document.getElementById('filter-start').value;
    const inputEnd = document.getElementById('filter-end').value;

    const todayStr = getCurrentDateString();
    
    // Set default filter UI
    document.getElementById('filter-start').value = inputStart || todayStr;
    document.getElementById('filter-end').value = inputEnd || todayStr;

    const filterStartDate = inputStart || todayStr;
    const filterEndDate = inputEnd || todayStr;

    let totalProfit = 0;
    let totalMechanic = 0;
    let totalSteam = 0;
    
    // Process Chart Data
    const chartLabels = [];
    const profitData = [];
    const mechanicData = [];
    const steamData = [];
    
    const chartMap = {};

    // Grouping all data by date
    state.transactions.forEach(t => {
        // filter logic
        if (t.date >= filterStartDate && t.date <= filterEndDate) {
            
            if(!chartMap[t.date]) {
                chartMap[t.date] = { profit: 0, mechanic: 0, steam: 0 };
            }

            let pft = 0;
            if(t.itemCode) {
                pft = (t.sellPrice - t.buyPrice);
                totalProfit += pft;
            }
            
            chartMap[t.date].profit += pft;

            if (t.workerId === 'mechanic') {
                totalMechanic += t.serviceFee;
                chartMap[t.date].mechanic += t.serviceFee;
            } else if (t.workerId === 'steam') {
                totalSteam += t.serviceFee;
                chartMap[t.date].steam += t.serviceFee;
            }
        }
    });

    Object.keys(chartMap).sort().forEach(date => {
        chartLabels.push(date);
        profitData.push(chartMap[date].profit);
        mechanicData.push(chartMap[date].mechanic);
        steamData.push(chartMap[date].steam);
    });

    elProfit.innerText = renderFormatRupiah(totalProfit);
    elMechanic.innerText = renderFormatRupiah(totalMechanic);
    elSteam.innerText = renderFormatRupiah(totalSteam);

    // Chart.js render
    const ctx = document.getElementById('dashboardChart');
    if (ctx && typeof Chart !== 'undefined') {
        if (dashboardChartInstance) {
            dashboardChartInstance.destroy();
        }
        
        dashboardChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    { label: 'Keuntungan Sparepart', data: profitData, backgroundColor: '#10B981' },
                    { label: 'Gaji Bengkel', data: mechanicData, backgroundColor: '#3B82F6' },
                    { label: 'Gaji Steam', data: steamData, backgroundColor: '#6366F1' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Notifications
    let lowStockHtml = '';
    state.inventory.forEach(i => {
        if (i.stock < 5) {
            lowStockHtml += `
            <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <p class="font-bold">Peringatan Stok Rendah!</p>
                <p>Stok untuk barang <b>${i.name}</b> hanya tersisa ${i.stock}. Segera restock!</p>
            </div>
            `;
        }
    });
    elNotifications.innerHTML = lowStockHtml;
}

function renderInventory() {
    const tbody = document.getElementById('inventory-list');
    const selectPos = document.getElementById('pos-item'); // for POS page
    
    if (tbody) {
        tbody.innerHTML = '';
        state.inventory.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-3 px-4 text-left">${item.name}</td>
                <td class="py-3 px-4 text-center capitalize">${item.category}</td>
                <td class="py-3 px-4 text-center font-bold ${item.stock < 5 ? 'text-red-500' : ''}">${item.stock}</td>
                <td class="py-3 px-4 text-right">${renderFormatRupiah(item.buyPrice)}</td>
                <td class="py-3 px-4 text-right">${renderFormatRupiah(item.sellPrice)}</td>
                <td class="py-3 px-4 text-right text-green-600 font-bold">${renderFormatRupiah(item.sellPrice - item.buyPrice)}</td>
                <td class="py-3 px-4 text-center">
                    <button onclick="editItem('${item.id}')" class="text-blue-500 hover:text-blue-700 mx-1" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteItem('${item.id}')" class="text-red-500 hover:text-red-700 mx-1" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    if (selectPos) {
        selectPos.innerHTML = '<option value="">-- Tanpa Barang (Jasa Saja) --</option>';
        state.inventory.forEach(item => {
            if(item.stock > 0) {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.innerText = `${item.name} - ${renderFormatRupiah(item.sellPrice)} (Sisa: ${item.stock})`;
                selectPos.appendChild(opt);
            }
        });
    }
}

// ----------------------------------------------------
// Inventory Form Handling (CRUD)
// ----------------------------------------------------
const formInventory = document.getElementById('form-inventory');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

if (formInventory) {
    formInventory.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const idInput = document.getElementById('inv-id').value;
        const nameInput = document.getElementById('inv-name').value;
        const categoryInput = document.getElementById('inv-category').value;
        const buyPriceInput = parseInt(document.getElementById('inv-buy-price').value);
        const sellPriceInput = parseInt(document.getElementById('inv-sell-price').value);
        const stockInput = parseInt(document.getElementById('inv-stock').value);

        if (idInput) {
            // Mode Edit
            updateDoc(doc(db, "inventory", idInput), {
                name: nameInput,
                category: categoryInput,
                buyPrice: buyPriceInput,
                sellPrice: sellPriceInput,
                stock: stockInput
            }).then(() => {
                alert('Barang berhasil diperbarui!');
                resetForm();
            }).catch(e => alert("Error: " + e.message));
        } else {
            // Mode Tambah Baru
            addDoc(collection(db, "inventory"), {
                name: nameInput,
                category: categoryInput,
                buyPrice: buyPriceInput,
                sellPrice: sellPriceInput,
                stock: stockInput
            }).then(() => {
                alert('Barang berhasil ditambahkan!');
                resetForm();
            }).catch(e => alert("Error: " + e.message));
        }
    });

    btnCancelEdit.addEventListener('click', () => {
        resetForm();
    });
}

function editItem(id) {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('form-title').innerText = "Edit Stok Barang";
    document.getElementById('inv-id').value = item.id;
    document.getElementById('inv-name').value = item.name;
    document.getElementById('inv-category').value = item.category;
    document.getElementById('inv-buy-price').value = item.buyPrice;
    document.getElementById('inv-sell-price').value = item.sellPrice;
    document.getElementById('inv-stock').value = item.stock;

    document.getElementById('btn-save-item').innerText = "Update Barang";
    document.getElementById('btn-save-item').classList.replace('bg-blue-500', 'bg-yellow-500');
    document.getElementById('btn-save-item').classList.replace('hover:bg-blue-700', 'hover:bg-yellow-700');
    
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    window.scrollTo(0, 0); // Scroll to top to see form
}

function deleteItem(id) {
    if (confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
        deleteDoc(doc(db, "inventory", id)).catch(e => alert("Error: " + e.message));
    }
}

function resetForm() {
    if(formInventory) {
        formInventory.reset();
        document.getElementById('inv-id').value = "";
        document.getElementById('form-title').innerText = "Tambah Stok Barang Baru";
        
        const btnSave = document.getElementById('btn-save-item');
        btnSave.innerText = "Simpan Barang";
        btnSave.classList.replace('bg-yellow-500', 'bg-blue-500');
        btnSave.classList.replace('hover:bg-yellow-700', 'hover:bg-blue-700');
        
        document.getElementById('btn-cancel-edit').classList.add('hidden');
    }
}

// ----------------------------------------------------
// POS / Transaction Handling
// ----------------------------------------------------
let cartCounter = [];

function renderCart() {
    const cartList = document.getElementById('cart-list');
    const elTotal = document.getElementById('cart-total');
    if (!cartList) return;

    cartList.innerHTML = '';
    let totalAll = 0;

    cartCounter.forEach((cartItem, index) => {
        totalAll += cartItem.total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2 px-4 border-b">${cartItem.itemName} <br><span class="text-xs text-gray-500">Pekerja: ${cartItem.workerName}</span></td>
            <td class="py-2 px-4 text-right border-b">${renderFormatRupiah(cartItem.sellPrice)}</td>
            <td class="py-2 px-4 text-right border-b">${renderFormatRupiah(cartItem.serviceFee)}</td>
            <td class="py-2 px-4 text-right border-b font-bold">${renderFormatRupiah(cartItem.total)}</td>
            <td class="py-2 px-4 text-center border-b">
                <button onclick="removeCart(${index})" class="text-red-500 hover:text-red-700 mx-auto"><i class="fas fa-trash"></i></button>
            </td>
        `;
        cartList.appendChild(tr);
    });

    elTotal.innerText = renderFormatRupiah(totalAll);
}

function removeCart(index) {
    cartCounter.splice(index, 1);
    renderCart();
}

const btnAddItem = document.getElementById('btn-add-item');
if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        const workerId = document.getElementById('pos-worker').value;
        const itemId = document.getElementById('pos-item').value;
        const serviceFeeInput = document.getElementById('pos-service-fee').value;
        
        let serviceFee = parseInt(serviceFeeInput || 0);

        if(!itemId && serviceFee <= 0) {
            alert('Isi barang atau biaya jasa terlebih dahulu!');
            return;
        }

        let item = null;
        if(itemId) {
            item = state.inventory.find(i => i.id === itemId);
        }

        const worker = state.workers.find(w => w.id === workerId);

        let sellPrice = item ? item.sellPrice : 0;
        let buyPrice = item ? item.buyPrice : 0;
        let itemName = item ? item.name : 'Jasa Murni';

        cartCounter.push({
            date: getCurrentDateString(),
            workerId: worker.id,
            workerName: worker.name,
            itemCode: item ? item.id : null,
            itemName: itemName,
            sellPrice: sellPrice,
            buyPrice: buyPrice,
            serviceFee: serviceFee,
            total: sellPrice + serviceFee
        });

        document.getElementById('pos-service-fee').value = '';
        renderCart();
    });
}

const btnCheckout = document.getElementById('btn-checkout');
if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
        if(cartCounter.length === 0) {
            alert('Keranjang kosong!');
            return;
        }

        cartCounter.forEach(cartItem => {
            // Deduct stock in Firestore
            if(cartItem.itemCode) {
                const invItem = state.inventory.find(i => i.id === cartItem.itemCode);
                if(invItem && invItem.stock > 0) {
                    updateDoc(doc(db, "inventory", cartItem.itemCode), {
                        stock: invItem.stock - 1
                    });
                }
            }

            // Salary updates implicitly through onSnapshot

            // Add to transaction history
            addDoc(collection(db, "transactions"), {
                date: cartItem.date,
                workerId: cartItem.workerId,
                workerName: cartItem.workerName,
                itemCode: cartItem.itemCode,
                itemName: cartItem.itemName,
                sellPrice: cartItem.sellPrice,
                buyPrice: cartItem.buyPrice,
                serviceFee: cartItem.serviceFee,
                total: cartItem.total
            });
        });

        cartCounter = [];
        renderCart();
        alert('Transaksi berhasil diproses!');
    });
}

function renderHistory() {
    const list = document.getElementById('transaction-history');
    if(!list) return;

    list.innerHTML = '';
    const todayStr = getCurrentDateString();
    
    // Filter history today, reverse so latest on top
    const todayTrans = state.transactions.filter(t => t.date === todayStr).reverse();

    if(todayTrans.length === 0) {
        list.innerHTML = '<li class="py-4 text-gray-500">Belum ada transaksi hari ini.</li>';
        return;
    }

    todayTrans.forEach(t => {
        const li = document.createElement('li');
        li.className = 'py-4';
        li.innerHTML = `
            <div class="flex space-x-3">
                <div class="flex-1 space-y-1">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-medium">${t.itemName}</h3>
                        <p class="text-sm text-gray-500">${renderFormatRupiah(t.total)}</p>
                    </div>
                    <p class="text-sm text-gray-500">${t.workerName} | Jasa: ${renderFormatRupiah(t.serviceFee)}</p>
                </div>
            </div>
        `;
        list.appendChild(li);
    });
}

// ----------------------------------------------------
// Data Reset & Export features
// ----------------------------------------------------
function exportToExcel() {
    if (typeof XLSX === "undefined") {
        alert("Library Excel belum dimuat.");
        return;
    }

    if (state.transactions.length === 0 && state.inventory.length === 0) {
        alert("Tidak ada data untuk di-export.");
        return;
    }

    const workbook = XLSX.utils.book_new();

    if (state.transactions.length > 0) {
        // Format data for transactions
        const exportTransactions = state.transactions.map(t => ({
            Tanggal: t.date,
            Pekerja: t.workerName,
            Barang: t.itemName,
            M_Beli: t.buyPrice,
            H_Jual: t.sellPrice,
            Jasa: t.serviceFee,
            Total: t.total,
            Keuntungan_Bengkel: (t.sellPrice - t.buyPrice)
        }));

        const worksheetTransactions = XLSX.utils.json_to_sheet(exportTransactions);
        XLSX.utils.book_append_sheet(workbook, worksheetTransactions, "Riwayat Transaksi");
    }

    if (state.inventory.length > 0) {
        // Format data for inventory
        const exportDate = getCurrentDateString();
        const exportInventory = state.inventory.map(i => ({
            Tanggal_Export: exportDate,
            Nama_Barang: i.name,
            Kategori: i.category,
            Stok: i.stock,
            Harga_Beli: i.buyPrice,
            Harga_Jual: i.sellPrice,
            Estimasi_Keuntungan: (i.sellPrice - i.buyPrice)
        }));

        const worksheetInventory = XLSX.utils.json_to_sheet(exportInventory);
        XLSX.utils.book_append_sheet(workbook, worksheetInventory, "Stok Barang");
    }

    XLSX.writeFile(workbook, "Laporan_Keuangan_Bengkel.xlsx");
}

async function resetTransactions() {
    if (confirm("AWAS! Anda akan menghapus seluruh data Transaksi dan Gaji. Pastikan Anda sudah Export ke Excel terlebih dahulu. Lanjutkan?")) {
        const querySnapshot = await getDocs(collection(db, "transactions"));
        querySnapshot.forEach((d) => {
            deleteDoc(doc(db, "transactions", d.id));
        });
        alert("Semua data transaksi di-reset menjadi 0.");
    }
}

// ----------------------------------------------------
// Initialization
// ----------------------------------------------------
loadStateFirebase();

// Export functions for HTML onclick handlers
window.exportToExcel = exportToExcel;
window.resetTransactions = resetTransactions;
window.applyDateFilter = applyDateFilter;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.removeCart = removeCart;
