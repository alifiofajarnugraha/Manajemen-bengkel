import { db } from "./firebase-init.js";
import {
    collection, addDoc, getDocs,
    updateDoc, doc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentDateString() {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(number || 0);
}

// ── State ────────────────────────────────────────────────────────────────────

let state = {
    inventory:            [],
    fotocopyInventory:    [],
    transactions:         [],
    expenses:             [],
    fotocopyTransactions: [],
    fotocopyExpenses:     [],
    workers: [
        { id: 'mechanic', name: 'Bapak A (Bengkel)', salaryToday: 0 },
        { id: 'steam',    name: 'Bapak B (Steam)',   salaryToday: 0 }
    ]
};

// ── Firebase listeners ───────────────────────────────────────────────────────

function loadStateFirebase() {
    // Inventory
    onSnapshot(collection(db, "inventory"), snapshot => {
        state.inventory = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderInventory();
        renderDashboard();
        updateStockNotifications();
    });

    // Fotocopy inventory (for low stock alerts)
    onSnapshot(collection(db, "fotocopy_inventory"), snapshot => {
        state.fotocopyInventory = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateStockNotifications();
    });

    // Transactions
    onSnapshot(collection(db, "transactions"), snapshot => {
        const todayStr   = getCurrentDateString();
        const todaySalaries = { mechanic: 0, steam: 0 };

        state.transactions = snapshot.docs.map(d => {
            const t = { id: d.id, ...d.data() };

            // Accumulate today's salary (FIX: parseFloat guard)
            if (t.date === todayStr && todaySalaries[t.workerId] !== undefined) {
                todaySalaries[t.workerId] += parseFloat(t.serviceFee) || 0;
            }
            return t;
        });

        state.workers.forEach(w => {
            w.salaryToday = todaySalaries[w.id] || 0;
        });

        renderDashboard();
        renderHistory();
    });

    // Expenses
    onSnapshot(collection(db, "expenses"), snapshot => {
        state.expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDashboard();
        if (typeof renderExpenses === 'function') renderExpenses();
    });

    // Fotocopy transactions (for dashboard profit card)
    onSnapshot(collection(db, "fotocopy_transactions"), snapshot => {
        state.fotocopyTransactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDashboard();
    });

    // Fotocopy expenses (for dashboard total expense)
    onSnapshot(collection(db, "fotocopy_expenses"), snapshot => {
        state.fotocopyExpenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDashboard();
    });
}

// ── Notification helper & Notification Center ────────────────────────────────

let activeNotifTab = 'all';
let notifSearchQuery = '';

function showNotification(html) {
    const el = document.getElementById('notification-area');
    if (el) el.innerHTML = html;
}

function buildAlertHtml(type, title, message) {
    // type: 'warning' | 'danger' | 'success'
    const styles = {
        warning: 'background:#fef3c7;border-color:#fcd34d;color:#92400e;',
        danger:  'background:#fee2e2;border-color:#fca5a5;color:#991b1b;',
        success: 'background:#d1fae5;border-color:#6ee7b7;color:#065f46;'
    };
    const icons = { warning: 'fa-exclamation-triangle', danger: 'fa-trash-alt', success: 'fa-check-circle' };
    const s = styles[type] || styles.warning;
    const i = icons[type]  || 'fa-info-circle';
    return `<div style="${s}border:1px solid;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;font-weight:500;">
                <i class="fas ${i}" style="margin-right:6px;"></i>
                <strong>${title}</strong> ${message}
            </div>`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateStockNotifications() {
    const bengkelLow = (state.inventory || []).filter(i => (parseInt(i.stock) || 0) < 5);
    const fcLow = (state.fotocopyInventory || []).filter(i => (parseInt(i.stock) || 0) < 5);
    const totalCount = bengkelLow.length + fcLow.length;

    // Header Bell Badge
    const headerBadge = document.getElementById('header-notif-badge');
    const headerBtn = document.getElementById('btn-header-notif');
    if (headerBadge) {
        if (totalCount > 0) {
            headerBadge.textContent = totalCount > 99 ? '99+' : totalCount;
            headerBadge.style.display = 'flex';
            if (headerBtn) headerBtn.classList.add('has-alert');
        } else {
            headerBadge.style.display = 'none';
            if (headerBtn) headerBtn.classList.remove('has-alert');
        }
    }

    // Sidebar Badge
    const sidebarBadge = document.getElementById('sidebar-notif-badge');
    if (sidebarBadge) {
        if (totalCount > 0) {
            sidebarBadge.textContent = totalCount > 99 ? '99+' : totalCount;
            sidebarBadge.style.display = 'inline-block';
        } else {
            sidebarBadge.style.display = 'none';
        }
    }

    // Mobile Bottom Nav Badge
    const bnavBadge = document.getElementById('bnav-notif-badge');
    if (bnavBadge) {
        if (totalCount > 0) {
            bnavBadge.textContent = totalCount > 99 ? '99+' : totalCount;
            bnavBadge.style.display = 'flex';
        } else {
            bnavBadge.style.display = 'none';
        }
    }

    // Modal Header Total Badge
    const totalModalBadge = document.getElementById('notif-total-badge');
    if (totalModalBadge) {
        if (totalCount > 0) {
            totalModalBadge.textContent = `${totalCount} Perlu Restock`;
            totalModalBadge.className = 'notif-chip-danger';
        } else {
            totalModalBadge.textContent = 'Semua Stok Aman';
            totalModalBadge.className = 'notif-chip-success';
        }
    }

    // Tab counters
    const elTabAll = document.getElementById('notif-tab-all-count');
    const elTabBengkel = document.getElementById('notif-tab-bengkel-count');
    const elTabFc = document.getElementById('notif-tab-fc-count');
    if (elTabAll) elTabAll.textContent = totalCount;
    if (elTabBengkel) elTabBengkel.textContent = bengkelLow.length;
    if (elTabFc) elTabFc.textContent = fcLow.length;

    renderNotifModalList();
}

function openNotificationModal() {
    const backdrop = document.getElementById('notif-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderNotifModalList();
    }
}

function closeNotificationModal() {
    const backdrop = document.getElementById('notif-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function toggleNotificationModal() {
    const backdrop = document.getElementById('notif-modal-backdrop');
    if (backdrop) {
        if (backdrop.classList.contains('active')) {
            closeNotificationModal();
        } else {
            openNotificationModal();
        }
    }
}

function closeNotificationModalOnBackdrop(event) {
    if (event && event.target && event.target.id === 'notif-modal-backdrop') {
        closeNotificationModal();
    }
}

function filterNotifTab(tabName) {
    activeNotifTab = tabName;
    document.querySelectorAll('.notif-tab').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderNotifModalList();
}

function filterNotifSearch(query) {
    notifSearchQuery = (query || '').toLowerCase().trim();
    renderNotifModalList();
}

function renderNotifModalList() {
    const container = document.getElementById('notif-items-container');
    if (!container) return;

    const bengkelItems = (state.inventory || [])
        .filter(i => (parseInt(i.stock) || 0) < 5)
        .map(i => ({ ...i, type: 'bengkel', typeLabel: 'Bengkel', link: 'inventory.html' }));

    const fcItems = (state.fotocopyInventory || [])
        .filter(i => (parseInt(i.stock) || 0) < 5)
        .map(i => ({ ...i, type: 'fotocopy', typeLabel: 'Fotocopy', link: 'fotocopy.html' }));

    let allItems = [];
    if (activeNotifTab === 'bengkel') {
        allItems = bengkelItems;
    } else if (activeNotifTab === 'fotocopy') {
        allItems = fcItems;
    } else {
        allItems = [...bengkelItems, ...fcItems];
    }

    if (notifSearchQuery) {
        allItems = allItems.filter(i =>
            (i.name || '').toLowerCase().includes(notifSearchQuery) ||
            (i.category || '').toLowerCase().includes(notifSearchQuery)
        );
    }

    // Sort: 0 stock (out of stock) first, then ascending stock
    allItems.sort((a, b) => {
        const stockA = parseInt(a.stock) || 0;
        const stockB = parseInt(b.stock) || 0;
        return stockA - stockB;
    });

    if (allItems.length === 0) {
        if (notifSearchQuery) {
            container.innerHTML = `
                <div class="notif-empty-state">
                    <div class="notif-empty-icon" style="background:#f1f5f9;color:#94a3b8;">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">Tidak Ada Hasil</h3>
                    <p style="font-size:12px;color:#64748b;">Tidak ada barang stok rendah yang sesuai dengan kata kunci "${escapeHtml(notifSearchQuery)}".</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="notif-empty-state">
                    <div class="notif-empty-icon" style="background:#dcfce7;color:#16a34a;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3 style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:6px;">Semua Stok Aman!</h3>
                    <p style="font-size:13px;color:#64748b;max-width:380px;line-height:1.6;">
                        ${activeNotifTab === 'all' 
                            ? 'Tidak ada barang yang memiliki stok di bawah batas minimum (5 unit).' 
                            : `Tidak ada barang ${activeNotifTab === 'bengkel' ? 'bengkel' : 'fotocopy'} yang menipis.`}
                    </p>
                </div>
            `;
        }
        return;
    }

    container.innerHTML = allItems.map(item => {
        const stock = parseInt(item.stock) || 0;
        const isOutOfStock = stock <= 0;
        const isBengkel = item.type === 'bengkel';

        return `
            <div class="notif-item-card ${isOutOfStock ? 'is-out-of-stock' : 'is-low-stock'}">
                <div class="notif-item-left">
                    <div class="notif-item-icon ${isBengkel ? 'icon-bengkel' : 'icon-fc'}">
                        <i class="fas ${isBengkel ? 'fa-wrench' : 'fa-print'}"></i>
                    </div>
                    <div class="notif-item-details">
                        <div class="notif-item-title-row">
                            <span class="notif-item-name">${escapeHtml(item.name || 'Tanpa Nama')}</span>
                            <span class="notif-tag ${isBengkel ? 'notif-tag-bengkel' : 'notif-tag-fc'}">
                                ${item.typeLabel}
                            </span>
                            ${item.category ? `<span class="notif-tag notif-tag-cat">${escapeHtml(item.category)}</span>` : ''}
                        </div>
                        <div class="notif-item-sub">
                            <span>Harga Beli: <b>${formatRupiah(item.buyPrice)}</b></span>
                            <span class="notif-dot">&bull;</span>
                            <span>Harga Jual: <b>${formatRupiah(item.sellPrice)}</b></span>
                        </div>
                    </div>
                </div>
                <div class="notif-item-right">
                    <div class="notif-stock-badge ${isOutOfStock ? 'stock-badge-out' : 'stock-badge-low'}">
                        <i class="fas ${isOutOfStock ? 'fa-times-circle' : 'fa-exclamation-triangle'}"></i>
                        <span>${isOutOfStock ? 'Stok Habis (0)' : `Sisa ${stock} pcs`}</span>
                    </div>
                    <a href="${item.link}" class="notif-btn-restock" title="Pergi ke halaman ${item.typeLabel}">
                        Restock <i class="fas fa-chevron-right" style="font-size:10px;margin-left:4px;"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNotificationModal();
    }
});

// ── Dashboard render ─────────────────────────────────────────────────────────

let dashboardChartInstance = null;

function applyDateFilter() {
    renderDashboard();
}

function renderDashboard() {
    const elProfit        = document.getElementById('daily-profit');
    const elMechanic      = document.getElementById('salary-mechanic');
    const elSteam         = document.getElementById('salary-steam');
    const elTotalExpense  = document.getElementById('total-expense');
    const elExpenseItems  = document.getElementById('total-expense-items');

    if (!elProfit) return; // Not on dashboard page

    const todayStr = getCurrentDateString();

    // Set default filter to today
    const inputStart = document.getElementById('filter-start');
    const inputEnd   = document.getElementById('filter-end');
    if (inputStart && !inputStart.value) inputStart.value = todayStr;
    if (inputEnd   && !inputEnd.value)   inputEnd.value   = todayStr;

    const filterStart = (inputStart && inputStart.value) || todayStr;
    const filterEnd   = (inputEnd   && inputEnd.value)   || todayStr;

    let totalProfit  = 0;
    let totalMechanic = 0;
    let totalSteam   = 0;
    let totalExpenseAmount = 0;
    let totalExpenseQty    = 0;

    const chartMap = {};

    // ── Aggregate transactions ────────────────────────────────────────────
    state.transactions.forEach(t => {
        if (t.date < filterStart || t.date > filterEnd) return;

        if (!chartMap[t.date]) {
            chartMap[t.date] = { profit: 0, mechanic: 0, steam: 0 };
        }

        // Profit from spare parts (sellPrice - buyPrice, only when item exists)
        const profit = t.itemCode ? ((parseFloat(t.sellPrice) || 0) - (parseFloat(t.buyPrice) || 0)) : 0;
        totalProfit += profit;
        chartMap[t.date].profit += profit;

        const fee = parseFloat(t.serviceFee) || 0;
        if (t.workerId === 'mechanic') {
            totalMechanic += fee;
            chartMap[t.date].mechanic += fee;
        } else if (t.workerId === 'steam') {
            totalSteam += fee;
            chartMap[t.date].steam += fee;
        }
    });

    // ── Aggregate fotocopy transactions ─────────────────────────────────
    let totalFcProfit = 0;
    let fcTxCount     = 0;
    state.fotocopyTransactions.forEach(t => {
        if (t.date < filterStart || t.date > filterEnd) return;
        totalFcProfit += parseFloat(t.netProfit) || 0;
        fcTxCount++;
        if (!chartMap[t.date]) chartMap[t.date] = { profit: 0, mechanic: 0, steam: 0, fotocopy: 0 };
        chartMap[t.date].fotocopy = (chartMap[t.date].fotocopy || 0) + (parseFloat(t.netProfit) || 0);
    });

    // ── Aggregate expenses ────────────────────────────────────────────────
    state.expenses.forEach(e => {
        if (e.date < filterStart || e.date > filterEnd) return;
        totalExpenseAmount += parseFloat(e.totalExpense) || 0;
        totalExpenseQty    += parseInt(e.qty) || 0;
    });

    // ── Aggregate fotocopy expenses ───────────────────────────────────────
    state.fotocopyExpenses.forEach(e => {
        if (e.date < filterStart || e.date > filterEnd) return;
        totalExpenseAmount += parseFloat(e.totalExpense) || 0;
        totalExpenseQty    += parseInt(e.qty) || 0;
    });

    // ── Update DOM ────────────────────────────────────────────────────────
    elProfit.textContent = formatRupiah(totalProfit);
    elMechanic.textContent = formatRupiah(totalMechanic);
    elSteam.textContent    = formatRupiah(totalSteam);
    if (elTotalExpense) elTotalExpense.textContent = formatRupiah(totalExpenseAmount);
    if (elExpenseItems) elExpenseItems.textContent = `${totalExpenseQty} Barang`;

    // Fotocopy profit card
    const elFcProfit   = document.getElementById('fc-profit');
    const elFcTxCount  = document.getElementById('fc-tx-count');
    if (elFcProfit)  elFcProfit.textContent  = formatRupiah(totalFcProfit);
    if (elFcTxCount) elFcTxCount.textContent = `${fcTxCount} Transaksi`;

    // ── Chart ─────────────────────────────────────────────────────────────
    const sortedDates = Object.keys(chartMap).sort();
    const chartLabels   = sortedDates;
    const profitData    = sortedDates.map(d => chartMap[d].profit);
    const mechanicData  = sortedDates.map(d => chartMap[d].mechanic);
    const steamData     = sortedDates.map(d => chartMap[d].steam);

    const ctx = document.getElementById('dashboardChart');
    if (ctx && typeof Chart !== 'undefined') {
        if (dashboardChartInstance) dashboardChartInstance.destroy();

        dashboardChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Keuntungan Sparepart',
                        data: profitData,
                        backgroundColor: 'rgba(16,185,129,0.8)',
                        borderRadius: 5,
                        borderSkipped: false
                    },
                    {
                        label: 'Gaji Bengkel',
                        data: mechanicData,
                        backgroundColor: 'rgba(37,99,235,0.8)',
                        borderRadius: 5,
                        borderSkipped: false
                    },
                    {
                        label: 'Gaji Steam',
                        data: steamData,
                        backgroundColor: 'rgba(99,102,241,0.8)',
                        borderRadius: 5,
                        borderSkipped: false
                    },
                    {
                        label: 'Untung Fotocopy',
                        data: sortedDates.map(d => (chartMap[d] && chartMap[d].fotocopy) || 0),
                        backgroundColor: 'rgba(124,58,237,0.8)',
                        borderRadius: 5,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ' ' + formatRupiah(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'DM Sans', size: 11 }, color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: {
                            font: { family: 'DM Sans', size: 11 },
                            color: '#94a3b8',
                            callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'k'
                        }
                    }
                }
            }
        });
    }

    // ── Low stock notifications (handled in notification bell modal) ───────
    updateStockNotifications();
}

// ── Inventory render ─────────────────────────────────────────────────────────

function renderInventory() {
    const tbody    = document.getElementById('inventory-list');
    const selectPos = document.getElementById('pos-item');

    if (tbody) {
        tbody.innerHTML = '';
        if (state.inventory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">
                Belum ada barang di inventori.</td></tr>`;
        } else {
            state.inventory.forEach(item => {
                const lowStock = (parseInt(item.stock) || 0) < 5;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-3 px-4 text-left">${item.name}</td>
                    <td class="py-3 px-4 text-center capitalize">${item.category || '-'}</td>
                    <td class="py-3 px-4 text-center font-bold ${lowStock ? 'text-red-500' : ''}">${item.stock}</td>
                    <td class="py-3 px-4 text-right">${formatRupiah(item.buyPrice)}</td>
                    <td class="py-3 px-4 text-right">${formatRupiah(item.sellPrice)}</td>
                    <td class="py-3 px-4 text-right text-green-600 font-bold">
                        ${formatRupiah((item.sellPrice || 0) - (item.buyPrice || 0))}
                    </td>
                    <td class="py-3 px-4 text-center">
                        <button onclick="editItem('${item.id}')" class="text-blue-500 hover:text-blue-700 mx-1" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteItem('${item.id}')" class="text-red-500 hover:text-red-700 mx-1" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        }
    }

    // Re-apply search filter if active
    if (typeof filterInventoryTable === 'function') filterInventoryTable();

    if (selectPos) {
        selectPos.innerHTML = '<option value="">-- Tanpa Barang (Jasa Saja) --</option>';
        state.inventory
            .filter(item => (parseInt(item.stock) || 0) > 0)
            .forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${item.name} – ${formatRupiah(item.sellPrice)} (Sisa: ${item.stock})`;
                selectPos.appendChild(opt);
            });
    }
}

function renderExpenses() {
    const tbody = document.getElementById('expenses-list');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // Sort by date descending
    const sorted = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">
            Belum ada riwayat pengeluaran.</td></tr>`;
    } else {
        sorted.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-3 px-4 text-left text-sm">${exp.date}</td>
                <td class="py-3 px-4 text-left text-sm font-medium">${exp.itemName}</td>
                <td class="py-3 px-4 text-center text-sm font-bold text-rose-500">+${exp.qty}</td>
                <td class="py-3 px-4 text-right text-sm">${formatRupiah(exp.buyPrice)}</td>
                <td class="py-3 px-4 text-right text-sm font-bold text-rose-600">${formatRupiah(exp.totalExpense)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ── Inventory CRUD ───────────────────────────────────────────────────────────

const formInventory = document.getElementById('form-inventory');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

if (formInventory) {
    formInventory.addEventListener('submit', async e => {
        e.preventDefault();

        const idInput        = document.getElementById('inv-id').value.trim();
        const nameInput      = document.getElementById('inv-name').value.trim();
        const categoryInput  = document.getElementById('inv-category').value.trim();
        const buyPriceInput  = parseInt(document.getElementById('inv-buy-price').value)  || 0;
        const sellPriceInput = parseInt(document.getElementById('inv-sell-price').value) || 0;
        const stockInput     = parseInt(document.getElementById('inv-stock').value)      || 0;

        if (!nameInput) { alert('Nama barang wajib diisi!'); return; }

        try {
            if (idInput) {
                // ── Edit mode ──────────────────────────────────────────────
                const oldItem = state.inventory.find(i => i.id === idInput);
                const addedStock = oldItem ? stockInput - (parseInt(oldItem.stock) || 0) : 0;

                await updateDoc(doc(db, "inventory", idInput), {
                    name:      nameInput,
                    category:  categoryInput,
                    buyPrice:  buyPriceInput,
                    sellPrice: sellPriceInput,
                    stock:     stockInput
                });

                // Only record expense when stock actually increases (FIX: guard addedStock > 0)
                if (addedStock > 0) {
                    await addDoc(collection(db, "expenses"), {
                        date:         getCurrentDateString(),
                        itemName:     nameInput,
                        qty:          addedStock,
                        buyPrice:     buyPriceInput,
                        totalExpense: addedStock * buyPriceInput
                    });
                }

                alert('Barang berhasil diperbarui!');

            } else {
                // ── Add new ────────────────────────────────────────────────
                await addDoc(collection(db, "inventory"), {
                    name:      nameInput,
                    category:  categoryInput,
                    buyPrice:  buyPriceInput,
                    sellPrice: sellPriceInput,
                    stock:     stockInput
                });

                if (stockInput > 0) {
                    await addDoc(collection(db, "expenses"), {
                        date:         getCurrentDateString(),
                        itemName:     nameInput,
                        qty:          stockInput,
                        buyPrice:     buyPriceInput,
                        totalExpense: stockInput * buyPriceInput
                    });
                }

                alert('Barang berhasil ditambahkan!');
            }

            resetInventoryForm();

        } catch (err) {
            alert('Error: ' + err.message);
        }
    });

    btnCancelEdit.addEventListener('click', resetInventoryForm);
}

function editItem(id) {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('form-title').textContent   = 'Edit Stok Barang';
    document.getElementById('inv-id').value             = item.id;
    document.getElementById('inv-name').value           = item.name;
    document.getElementById('inv-category').value       = item.category || '';
    document.getElementById('inv-buy-price').value      = item.buyPrice;
    document.getElementById('inv-sell-price').value     = item.sellPrice;
    document.getElementById('inv-stock').value          = item.stock;

    const btnSave = document.getElementById('btn-save-item');
    btnSave.textContent = 'Update Barang';
    btnSave.classList.replace('bg-blue-500',       'bg-yellow-500');
    btnSave.classList.replace('hover:bg-blue-700', 'hover:bg-yellow-700');

    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteItem(id) {
    if (confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
        deleteDoc(doc(db, "inventory", id)).catch(e => alert('Error: ' + e.message));
    }
}

function resetInventoryForm() {
    if (!formInventory) return;

    formInventory.reset();
    document.getElementById('inv-id').value = '';
    document.getElementById('form-title').textContent = 'Tambah Stok Barang Baru';

    const btnSave = document.getElementById('btn-save-item');
    if (btnSave) {
        btnSave.textContent = 'Simpan Barang';
        btnSave.classList.replace('bg-yellow-500',       'bg-blue-500');
        btnSave.classList.replace('hover:bg-yellow-700', 'hover:bg-blue-700');
    }

    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

// ── POS / Cart ───────────────────────────────────────────────────────────────

let cart = [];

function renderCart() {
    const cartList = document.getElementById('cart-list');
    const elTotal  = document.getElementById('cart-total');
    if (!cartList) return;

    cartList.innerHTML = '';
    let totalAll = 0;

    cart.forEach((cartItem, index) => {
        totalAll += cartItem.total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2 px-4 border-b">
                ${cartItem.itemName}
                <br><span class="text-xs text-gray-500">Pekerja: ${cartItem.workerName}</span>
            </td>
            <td class="py-2 px-4 text-right border-b">${formatRupiah(cartItem.sellPrice)}</td>
            <td class="py-2 px-4 text-right border-b">${formatRupiah(cartItem.serviceFee)}</td>
            <td class="py-2 px-4 text-right border-b font-bold">${formatRupiah(cartItem.total)}</td>
            <td class="py-2 px-4 text-center border-b">
                <button onclick="removeCart(${index})" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </td>`;
        cartList.appendChild(tr);
    });

    if (elTotal) elTotal.textContent = formatRupiah(totalAll);
}

function removeCart(index) {
    cart.splice(index, 1);
    renderCart();
}

// Show/hide service fee vs qty inputs based on worker type
const posWorker           = document.getElementById('pos-worker');
const containerServiceFee = document.getElementById('container-service-fee');
const containerQty        = document.getElementById('container-qty');

function updatePosWorkerUI(workerId) {
    if (!containerServiceFee || !containerQty) return;
    if (workerId === 'steam') {
        containerServiceFee.style.display = 'none';
        containerQty.style.display        = 'block';
    } else {
        containerServiceFee.style.display = 'block';
        containerQty.style.display        = 'none';
    }
}

if (posWorker) {
    updatePosWorkerUI(posWorker.value);
    posWorker.addEventListener('change', e => updatePosWorkerUI(e.target.value));
}

const btnAddItem = document.getElementById('btn-add-item');
if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        const workerId = document.getElementById('pos-worker').value;
        const itemId   = document.getElementById('pos-item').value;
        const worker   = state.workers.find(w => w.id === workerId);

        if (!worker) { alert('Pilih pekerja terlebih dahulu!'); return; }

        let item      = itemId ? state.inventory.find(i => i.id === itemId) : null;
        let sellPrice = item ? (parseFloat(item.sellPrice) || 0) : 0;
        let buyPrice  = item ? (parseFloat(item.buyPrice)  || 0) : 0;
        let itemName  = item ? item.name : 'Jasa Murni';
        let itemCode  = item ? item.id   : null;
        let serviceFee = 0;

        if (workerId === 'steam') {
            const qtyInput = document.getElementById('pos-qty');
            const qty      = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);

            const steamSell = 10000 * qty;
            const steamFee  =  5000 * qty;

            if (item) {
                // FIX: check stock before adding steam service on item
                if ((parseInt(item.stock) || 0) < 1) {
                    alert(`Stok ${item.name} habis!`);
                    return;
                }
                sellPrice += steamSell;
                itemName  += ` + Cuci Steam (${qty}x)`;
            } else {
                sellPrice = steamSell;
                buyPrice  = 0;
                itemName  = `Cuci Steam (${qty}x)`;
                itemCode  = 'steam_service';
            }

            serviceFee = steamFee;
            if (qtyInput) qtyInput.value = 1;

        } else {
            const feeInput = document.getElementById('pos-service-fee');
            serviceFee     = parseInt(feeInput ? feeInput.value : 0) || 0;

            if (!itemId && serviceFee <= 0) {
                alert('Isi barang atau biaya jasa terlebih dahulu!');
                return;
            }

            // FIX: check stock for non-steam mechanic
            if (item && (parseInt(item.stock) || 0) < 1) {
                alert(`Stok ${item.name} habis!`);
                return;
            }

            if (feeInput) feeInput.value = '';
        }

        cart.push({
            date:       getCurrentDateString(),
            workerId:   worker.id,
            workerName: worker.name,
            itemCode,
            itemName,
            sellPrice,
            buyPrice,
            serviceFee,
            total: sellPrice + serviceFee
        });

        renderCart();
    });
}

const btnCheckout = document.getElementById('btn-checkout');
if (btnCheckout) {
    btnCheckout.addEventListener('click', async () => {
        if (cart.length === 0) { alert('Keranjang kosong!'); return; }

        try {
            for (const cartItem of cart) {
                // Deduct stock (skip steam_service pseudo-code)
                if (cartItem.itemCode && cartItem.itemCode !== 'steam_service') {
                    const invItem = state.inventory.find(i => i.id === cartItem.itemCode);
                    if (invItem) {
                        const newStock = Math.max(0, (parseInt(invItem.stock) || 0) - 1);
                        await updateDoc(doc(db, "inventory", cartItem.itemCode), { stock: newStock });
                    }
                }

                await addDoc(collection(db, "transactions"), {
                    date:       cartItem.date,
                    workerId:   cartItem.workerId,
                    workerName: cartItem.workerName,
                    itemCode:   cartItem.itemCode,
                    itemName:   cartItem.itemName,
                    sellPrice:  cartItem.sellPrice,
                    buyPrice:   cartItem.buyPrice,
                    serviceFee: cartItem.serviceFee,
                    total:      cartItem.total
                });
            }

            cart = [];
            renderCart();
            alert('Transaksi berhasil diproses!');

        } catch (err) {
            alert('Error saat checkout: ' + err.message);
        }
    });
}

// ── Transaction history ───────────────────────────────────────────────────────

function renderHistory() {
    const list = document.getElementById('transaction-history');
    if (!list) return;

    const todayStr   = getCurrentDateString();
    const todayTrans = state.transactions
        .filter(t => t.date === todayStr)
        .slice()
        .reverse();

    if (todayTrans.length === 0) {
        list.innerHTML = '<li class="py-4 text-gray-500">Belum ada transaksi hari ini.</li>';
        return;
    }

    list.innerHTML = '';
    todayTrans.forEach(t => {
        const li = document.createElement('li');
        li.className = 'py-4';
        li.innerHTML = `
            <div class="flex space-x-3">
                <div class="flex-1 space-y-1">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-medium">${t.itemName}</h3>
                        <p class="text-sm text-gray-500">${formatRupiah(t.total)}</p>
                    </div>
                    <p class="text-sm text-gray-500">${t.workerName} | Jasa: ${formatRupiah(t.serviceFee)}</p>
                </div>
            </div>`;
        list.appendChild(li);
    });
}

// ── Export & Reset ────────────────────────────────────────────────────────────

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Library Excel belum dimuat.');
        return;
    }

    const hasData = state.transactions.length > 0
        || state.inventory.length > 0
        || state.expenses.length > 0;

    if (!hasData) {
        alert('Tidak ada data untuk di-export.');
        return;
    }

    const wb = XLSX.utils.book_new();

    if (state.transactions.length > 0) {
        const rows = state.transactions.map(t => ({
            Tanggal:             t.date,
            Pekerja:             t.workerName,
            Barang:              t.itemName,
            Modal_Beli:          t.buyPrice   || 0,
            Harga_Jual:          t.sellPrice  || 0,
            Biaya_Jasa:          t.serviceFee || 0,
            Total:               t.total      || 0,
            Keuntungan_Sparepart: ((t.sellPrice || 0) - (t.buyPrice || 0))
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Riwayat Transaksi');
    }

    if (state.expenses.length > 0) {
        const rows = state.expenses.map(e => ({
            Tanggal_Restock:    e.date,
            Nama_Barang:        e.itemName,
            Jumlah_Ditambahkan: e.qty,
            Harga_Beli_Satuan:  e.buyPrice,
            Total_Pengeluaran:  e.totalExpense
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Riwayat Pengeluaran');
    }

    if (state.inventory.length > 0) {
        const today = getCurrentDateString();
        const rows  = state.inventory.map(i => ({
            Tanggal_Export:       today,
            Nama_Barang:          i.name,
            Kategori:             i.category || '-',
            Stok:                 i.stock,
            Harga_Beli:           i.buyPrice,
            Harga_Jual:           i.sellPrice,
            Estimasi_Keuntungan:  (i.sellPrice - i.buyPrice)
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stok Barang');
    }

    XLSX.writeFile(wb, 'Laporan_Keuangan_Bengkel.xlsx');
}

async function resetTransactions() {
    const confirmed = confirm(
        'PERHATIAN!\n\nAnda akan menghapus seluruh data Transaksi dan Pengeluaran.\n' +
        'Pastikan sudah Export ke Excel terlebih dahulu.\n\nLanjutkan?'
    );
    if (!confirmed) return;

    try {
        const [txSnap, expSnap] = await Promise.all([
            getDocs(collection(db, "transactions")),
            getDocs(collection(db, "expenses"))
        ]);

        const deletes = [
            ...txSnap.docs.map(d  => deleteDoc(doc(db, "transactions", d.id))),
            ...expSnap.docs.map(d => deleteDoc(doc(db, "expenses",     d.id)))
        ];

        await Promise.all(deletes);

        showNotification(buildAlertHtml('danger', 'Reset selesai.', 'Semua data transaksi dan pengeluaran telah dihapus.'));

    } catch (err) {
        alert('Error saat reset: ' + err.message);
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadStateFirebase();

// Expose to HTML onclick handlers
window.exportToExcel                    = exportToExcel;
window.resetTransactions                = resetTransactions;
window.applyDateFilter                  = applyDateFilter;
window.editItem                         = editItem;
window.deleteItem                       = deleteItem;
window.removeCart                       = removeCart;
window.renderExpenses                   = renderExpenses;
window.openNotificationModal            = openNotificationModal;
window.closeNotificationModal           = closeNotificationModal;
window.toggleNotificationModal          = toggleNotificationModal;
window.closeNotificationModalOnBackdrop = closeNotificationModalOnBackdrop;
window.filterNotifTab                   = filterNotifTab;
window.filterNotifSearch                = filterNotifSearch;