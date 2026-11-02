import { db } from "./firebase-init.js";
import {
    collection, addDoc, getDocs,
    updateDoc, doc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Notification Modal Control ─────────────────────────────────────────────────────────────────────────────
window.toggleFcNotificationModal = function () {
    const backdrop = document.getElementById('fc-notif-modal-backdrop');
    if (backdrop) backdrop.classList.toggle('active');
};

window.openFcNotificationModal = function () {
    const backdrop = document.getElementById('fc-notif-modal-backdrop');
    if (backdrop) backdrop.classList.add('active');
};

window.closeFcNotificationModal = function () {
    const backdrop = document.getElementById('fc-notif-modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
};

window.closeFcNotificationModalOnBackdrop = function (event) {
    if (event.target.id === 'fc-notif-modal-backdrop') {
        closeFcNotificationModal();
    }
};

// ── Sidebar Notif Link Handler ─────────────────────────────────────────────────────────────────────────────
const sidebarFcNotifLink = document.getElementById('sidebar-fc-notif-link');
if (sidebarFcNotifLink) {
    sidebarFcNotifLink.addEventListener('click', function(e) {
        e.preventDefault();
        toggleFcNotificationModal();
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCurrentDateString() {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(num || 0);
}

// ── State ────────────────────────────────────────────────────────────────────
let fcState = {
    inventory:    [],
    transactions: [],
    expenses:     []
};

// Shopping cart: [{ itemId, itemName, qty, sellPrice, buyPrice, subtotal }]
let fcCart = [];

// ── Firebase Listeners ───────────────────────────────────────────────────────
function loadFcFirebase() {
    onSnapshot(collection(db, "fotocopy_inventory"), snap => {
        fcState.inventory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFcInventory();
        renderFcItemSelect();
        renderFcNotifModalList();
    });

    onSnapshot(collection(db, "fotocopy_transactions"), snap => {
        fcState.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFcHistoryToday();
        renderFcAllTransactions();
    });

    onSnapshot(collection(db, "fotocopy_expenses"), snap => {
        fcState.expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFcExpenses();
    });
}

// ── Render: Item select (kasir) ──────────────────────────────────────────────
function renderFcItemSelect() {
    const sel = document.getElementById('fc-item');
    if (!sel) return;
    // Keep first two options (placeholder & jasa manual)
    while (sel.options.length > 2) sel.remove(2);

    fcState.inventory
        .filter(i => (parseInt(i.stock) || 0) > 0)
        .forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} – ${formatRupiah(item.sellPrice)} (Stok: ${item.stock})`;
            sel.appendChild(opt);
        });
}

// ── Cart Logic ───────────────────────────────────────────────────────────────
window.fcAddToCart = function () {
    const itemId  = document.getElementById('fc-item').value;
    const qty     = Math.max(1, parseInt(document.getElementById('fc-qty').value) || 1);

    if (!itemId) { alert('Pilih barang terlebih dahulu!'); return; }

    let itemName, sellPrice, buyPrice, itemCode;

    if (itemId === '__jasa__') {
        // Manual jasa
        itemName  = document.getElementById('fc-jasa-name').value.trim();
        sellPrice = parseFloat(document.getElementById('fc-jasa-price').value) || 0;
        buyPrice  = 0;
        itemCode  = '__jasa__';
        if (!itemName || sellPrice <= 0) {
            alert('Isi nama jasa dan harga jual untuk layanan manual!'); return;
        }
    } else {
        const item = fcState.inventory.find(i => i.id === itemId);
        if (!item) { alert('Barang tidak ditemukan!'); return; }
        if ((parseInt(item.stock) || 0) < qty) {
            alert(`Stok ${item.name} tidak cukup! Tersedia: ${item.stock}`); return;
        }
        itemName  = item.name;
        sellPrice = parseFloat(item.sellPrice) || 0;
        buyPrice  = parseFloat(item.buyPrice)  || 0;
        itemCode  = item.id;
    }

    // Cek apakah item sudah ada di cart — kalau ada, tambah qty-nya
    const existing = fcCart.find(c => c.itemCode === itemCode && itemCode !== '__jasa__');
    if (existing) {
        // Cek stok lagi dengan qty gabungan
        if (itemCode !== '__jasa__') {
            const item = fcState.inventory.find(i => i.id === itemCode);
            if (item && (parseInt(item.stock) || 0) < (existing.qty + qty)) {
                alert(`Stok ${item.name} tidak cukup untuk total ${existing.qty + qty} item!`); return;
            }
        }
        existing.qty += qty;
        existing.subtotal = existing.qty * existing.sellPrice;
    } else {
        fcCart.push({
            date:      getCurrentDateString(),
            itemCode,
            itemName,
            qty,
            sellPrice,
            buyPrice,
            subtotal:  qty * sellPrice
        });
    }

    // Reset qty & jasa fields
    document.getElementById('fc-qty').value = 1;
    if (itemCode === '__jasa__') {
        document.getElementById('fc-jasa-name').value  = '';
        document.getElementById('fc-jasa-price').value = '';
    }

    fcUpdateCart();
};

window.fcRemoveCart = function (index) {
    fcCart.splice(index, 1);
    fcUpdateCart();
};

window.fcUpdateCart = function () {
    const tbody = document.getElementById('fc-cart-list');
    const emptyRow = document.getElementById('fc-cart-empty');
    if (!tbody) return;

    // Clear existing rows (except hidden empty placeholder)
    [...tbody.querySelectorAll('tr:not(#fc-cart-empty)')].forEach(r => r.remove());

    if (fcCart.length === 0) {
        if (emptyRow) emptyRow.style.display = '';
        document.getElementById('fc-subtotal-display').textContent = 'Rp 0';
        document.getElementById('fc-total-display').textContent    = 'Rp 0';
        document.getElementById('disc-line').style.setProperty('display', 'none', 'important');
        document.getElementById('disc-preview').classList.add('hidden');
        return;
    }

    if (emptyRow) emptyRow.style.display = 'none';

    let subtotal = 0;
    fcCart.forEach((item, idx) => {
        subtotal += item.subtotal;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-2 px-4 border-b">${item.itemName}${item.itemCode === '__jasa__' ? ' <span class="badge-purple">Jasa</span>' : ''}</td>
            <td class="py-2 px-4 text-center border-b">${item.qty}</td>
            <td class="py-2 px-4 text-right border-b">${formatRupiah(item.sellPrice)}</td>
            <td class="py-2 px-4 text-right border-b font-semibold">${formatRupiah(item.subtotal)}</td>
            <td class="py-2 px-4 text-center border-b">
                <button onclick="fcRemoveCart(${idx})" class="text-rose-500 hover:text-rose-700 text-sm"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    // Discount calculation
    const discountInput = parseFloat(document.getElementById('fc-discount').value) || 0;
    const discountType  = typeof discType !== 'undefined' ? discType : 'persen';
    let   discountAmount = 0;

    if (discountInput > 0) {
        if (discountType === 'persen') {
            discountAmount = subtotal * (Math.min(discountInput, 100) / 100);
        } else {
            discountAmount = Math.min(discountInput, subtotal);
        }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Update display
    document.getElementById('fc-subtotal-display').textContent = formatRupiah(subtotal);
    document.getElementById('fc-total-display').textContent    = formatRupiah(total);

    const discLine = document.getElementById('disc-line');
    if (discountAmount > 0) {
        discLine.style.removeProperty('display');
        document.getElementById('fc-discount-display').textContent = `- ${formatRupiah(discountAmount)}`;
        const label = discountType === 'persen'
            ? `(${discountInput}%)`
            : `(Nominal)`;
        document.getElementById('disc-info-label').textContent = label;

        // Preview
        const preview = document.getElementById('disc-preview');
        preview.classList.remove('hidden');
        preview.textContent = `💡 Diskon ${discountType === 'persen' ? discountInput + '%' : formatRupiah(discountInput)}: hemat ${formatRupiah(discountAmount)} dari subtotal ${formatRupiah(subtotal)}.`;
    } else {
        discLine.style.setProperty('display', 'none', 'important');
        document.getElementById('disc-preview').classList.add('hidden');
    }
};

// ── Checkout ─────────────────────────────────────────────────────────────────
window.fcCheckout = async function () {
    if (fcCart.length === 0) { alert('Keranjang kosong!'); return; }

    const discountInput  = parseFloat(document.getElementById('fc-discount').value) || 0;
    const discountType   = typeof discType !== 'undefined' ? discType : 'persen';
    const subtotal       = fcCart.reduce((s, i) => s + i.subtotal, 0);
    let   discountAmount = 0;

    if (discountInput > 0) {
        discountAmount = discountType === 'persen'
            ? subtotal * (Math.min(discountInput, 100) / 100)
            : Math.min(discountInput, subtotal);
    }

    const totalBayar = Math.max(0, subtotal - discountAmount);

    if (!confirm(`Total pembayaran: ${formatRupiah(totalBayar)}\n${discountAmount > 0 ? `(Diskon: ${formatRupiah(discountAmount)})\n` : ''}Proses transaksi?`)) return;

    try {
        const date = getCurrentDateString();
        const txItems = fcCart.map(c => ({
            itemCode:  c.itemCode,
            itemName:  c.itemName,
            qty:       c.qty,
            sellPrice: c.sellPrice,
            buyPrice:  c.buyPrice,
            subtotal:  c.subtotal
        }));

        // Profit = sum of (sellPrice - buyPrice) * qty — then minus discount
        const rawProfit    = fcCart.reduce((s, c) => s + (c.sellPrice - c.buyPrice) * c.qty, 0);
        const netProfit    = Math.max(0, rawProfit - discountAmount);

        // Write transaction
        await addDoc(collection(db, "fotocopy_transactions"), {
            date,
            items:          txItems,
            subtotal,
            discountType,
            discountInput,
            discountAmount,
            totalBayar,
            rawProfit,
            netProfit
        });

        // Deduct stock for each item
        for (const cartItem of fcCart) {
            if (cartItem.itemCode && cartItem.itemCode !== '__jasa__') {
                const invItem = fcState.inventory.find(i => i.id === cartItem.itemCode);
                if (invItem) {
                    const newStock = Math.max(0, (parseInt(invItem.stock) || 0) - cartItem.qty);
                    await updateDoc(doc(db, "fotocopy_inventory", cartItem.itemCode), { stock: newStock });
                }
            }
        }

        // Reset cart & discount
        fcCart = [];
        document.getElementById('fc-discount').value = 0;
        fcUpdateCart();

        // Show success notification
        const notifArea = document.getElementById('fc-notification-area');
        if (notifArea) {
            notifArea.innerHTML = `<div style="background:#d1fae5;border:1px solid #6ee7b7;color:#065f46;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:500;">
                <i class="fas fa-check-circle" style="margin-right:6px;"></i>
                <strong>Transaksi berhasil!</strong> Total bayar: ${formatRupiah(totalBayar)}${discountAmount > 0 ? `, diskon: ${formatRupiah(discountAmount)}` : ''}.
            </div>`;
            setTimeout(() => { notifArea.innerHTML = ''; }, 4000);
        }

    } catch (err) {
        alert('Error saat checkout: ' + err.message);
    }
};

// ── Render: History Today (sidebar kasir) ────────────────────────────────────
function renderFcHistoryToday() {
    const ul = document.getElementById('fc-history-today');
    if (!ul) return;

    const today = getCurrentDateString();
    const todays = fcState.transactions
        .filter(t => t.date === today)
        .slice().reverse();

    if (todays.length === 0) {
        ul.innerHTML = '<li class="py-4 text-slate-400 text-sm text-center">Belum ada transaksi hari ini.</li>';
        return;
    }

    ul.innerHTML = '';
    todays.forEach(t => {
        const li = document.createElement('li');
        li.className = 'py-3';
        const itemNames = (t.items || []).map(i => `${i.itemName} x${i.qty}`).join(', ');
        li.innerHTML = `
            <div class="flex justify-between items-start gap-2">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate">${itemNames || '-'}</p>
                    ${t.discountAmount > 0 ? `<p class="text-xs text-amber-600">Diskon: ${formatRupiah(t.discountAmount)}</p>` : ''}
                    <p class="text-xs text-slate-500">Untung: ${formatRupiah(t.netProfit)}</p>
                </div>
                <p class="text-sm font-bold text-violet-700 shrink-0">${formatRupiah(t.totalBayar)}</p>
            </div>`;
        ul.appendChild(li);
    });
}

// ── Render: All Transactions (riwayat tab) ───────────────────────────────────
function renderFcAllTransactions() {
    const tbody = document.getElementById('fc-tx-all-list');
    if (!tbody) return;

    const sorted = [...fcState.transactions].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada transaksi.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    sorted.forEach(t => {
        const itemNames = (t.items || []).map(i => `${i.itemName} (×${i.qty})`).join(', ');
        const totalQty  = (t.items || []).reduce((s, i) => s + (i.qty || 0), 0);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="py-2 px-4 border-b text-slate-600">${t.date}</td>
            <td class="py-2 px-4 border-b max-w-xs truncate" title="${itemNames}">${itemNames}</td>
            <td class="py-2 px-4 border-b text-center font-medium">${totalQty}</td>
            <td class="py-2 px-4 border-b text-right">${formatRupiah(t.subtotal)}</td>
            <td class="py-2 px-4 border-b text-right text-amber-600 font-semibold">${t.discountAmount > 0 ? `- ${formatRupiah(t.discountAmount)}` : '-'}</td>
            <td class="py-2 px-4 border-b text-right font-bold text-violet-700">${formatRupiah(t.totalBayar)}</td>
            <td class="py-2 px-4 border-b text-right text-emerald-600 font-bold">${formatRupiah(t.netProfit)}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Render: Inventory Table ──────────────────────────────────────────────────
function renderFcInventory() {
    const tbody = document.getElementById('fc-inventory-list');
    if (!tbody) return;

    if (fcState.inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada barang di inventori.</td></tr>';
        // Re-apply search filter if active
        if (typeof filterFcInventoryTable === 'function') filterFcInventoryTable();
        return;
    }

    tbody.innerHTML = '';
    fcState.inventory.forEach(item => {
        const lowStock = (parseInt(item.stock) || 0) < 5;
        const profit   = (parseFloat(item.sellPrice) || 0) - (parseFloat(item.buyPrice) || 0);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="py-3 px-4 border-b font-medium">${item.name}</td>
            <td class="py-3 px-4 border-b text-center capitalize text-slate-500">${item.category || '-'}</td>
            <td class="py-3 px-4 border-b text-center font-bold ${lowStock ? 'badge-low' : 'text-emerald-600'}">${item.stock}</td>
            <td class="py-3 px-4 border-b text-right">${formatRupiah(item.buyPrice)}</td>
            <td class="py-3 px-4 border-b text-right">${formatRupiah(item.sellPrice)}</td>
            <td class="py-3 px-4 border-b text-right text-emerald-600 font-semibold">${formatRupiah(profit)}</td>
            <td class="py-3 px-4 border-b text-center">
                <button onclick="fcEditItem('${item.id}')" class="text-blue-500 hover:text-blue-700 mx-1" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick="fcDeleteItem('${item.id}')" class="text-rose-500 hover:text-rose-700 mx-1" title="Hapus"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    // Re-apply search filter if active
    if (typeof filterFcInventoryTable === 'function') filterFcInventoryTable();
}

// ── Render: Expenses Table ───────────────────────────────────────────────────
function renderFcExpenses() {
    const tbody = document.getElementById('fc-expenses-list');
    if (!tbody) return;

    const sorted = [...fcState.expenses].sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada riwayat pengeluaran.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    sorted.forEach(e => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="py-3 px-4 border-b text-slate-600">${e.date}</td>
            <td class="py-3 px-4 border-b font-medium">${e.itemName}</td>
            <td class="py-3 px-4 border-b text-center font-bold text-rose-500">+${e.qty}</td>
            <td class="py-3 px-4 border-b text-right">${formatRupiah(e.buyPrice)}</td>
            <td class="py-3 px-4 border-b text-right font-bold text-rose-600">${formatRupiah(e.totalExpense)}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Low Stock Notification ───────────────────────────────────────────────────
let fcNotifSearchQuery = '';
let activeFcNotifTab = 'all';

function filterFcNotifTab(tabName) {
    activeFcNotifTab = tabName;
    document.querySelectorAll('#fc-notif-modal-backdrop .notif-tab').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderFcNotifModalList();
}

function filterFcNotifSearch(query) {
    fcNotifSearchQuery = (query || '').toLowerCase().trim();
    renderFcNotifModalList();
}

function renderFcNotifModalList() {
    const container = document.getElementById('fc-notif-items-container');
    const badge = document.getElementById('fc-notif-badge');
    const sidebarBadge = document.getElementById('sidebar-fc-notif-badge');
    const btn = document.getElementById('btn-fc-notif');
    const sidebarBtn = document.getElementById('sidebar-fc-notif-link');
    const totalBadge = document.getElementById('fc-notif-total-badge');
    const tabAllCount = document.getElementById('fc-notif-tab-all-count');
    const tabLowCount = document.getElementById('fc-notif-tab-low-count');

    if (!container) return;

    const allItems = fcState.inventory || [];
    const lowItems = allItems.filter(i => (parseInt(i.stock) || 0) < 5);
    const outItems = allItems.filter(i => (parseInt(i.stock) || 0) <= 0);
    
    // Update badges
    if (badge) {
        badge.textContent = lowItems.length;
        badge.style.display = lowItems.length > 0 ? '' : 'none';
    }
    if (sidebarBadge) {
        sidebarBadge.textContent = lowItems.length;
        sidebarBadge.style.display = lowItems.length > 0 ? '' : 'none';
    }
    if (totalBadge) {
        totalBadge.textContent = `${lowItems.length} Perlu Restock`;
        totalBadge.style.display = lowItems.length > 0 ? '' : 'none';
    }
    if (tabAllCount) tabAllCount.textContent = lowItems.length;
    if (tabLowCount) tabLowCount.textContent = lowItems.length;
    
    if (btn) {
        if (lowItems.length > 0) btn.classList.add('has-alert');
        else btn.classList.remove('has-alert');
    }
    if (sidebarBtn) {
        sidebarBtn.style.background = lowItems.length > 0 ? 'rgba(244, 63, 94, 0.15)' : '';
    }

    // Filter by tab
    let filteredItems = lowItems;
    if (activeFcNotifTab === 'low') {
        filteredItems = lowItems;
    }
    
    // Filter by search
    if (fcNotifSearchQuery) {
        filteredItems = filteredItems.filter(i =>
            (i.name || '').toLowerCase().includes(fcNotifSearchQuery) ||
            (i.category || '').toLowerCase().includes(fcNotifSearchQuery)
        );
    }
    
    // Sort: out of stock first, then ascending stock
    filteredItems.sort((a, b) => {
        const stockA = parseInt(a.stock) || 0;
        const stockB = parseInt(b.stock) || 0;
        return stockA - stockB;
    });

    if (filteredItems.length === 0) {
        if (fcNotifSearchQuery) {
            container.innerHTML = `
                <div class="notif-empty-state">
                    <div class="notif-empty-icon" style="background:#f1f5f9;color:#94a3b8;">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">Tidak Ada Hasil</h3>
                    <p style="font-size:12px;color:#64748b;">Tidak ada barang stok rendah yang sesuai dengan kata kunci "${fcNotifSearchQuery}".</p>
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
                        Tidak ada barang yang memiliki stok di bawah batas minimum (5 unit).
                    </p>
                </div>
            `;
        }
        return;
    }

    container.innerHTML = filteredItems.map(item => {
        const stock = parseInt(item.stock) || 0;
        const isOutOfStock = stock <= 0;

        return `
            <div class="notif-item-card ${isOutOfStock ? 'is-out-of-stock' : 'is-low-stock'}">
                <div class="notif-item-left">
                    <div class="notif-item-icon icon-fc">
                        <i class="fas fa-print"></i>
                    </div>
                    <div class="notif-item-details">
                        <div class="notif-item-title-row">
                            <span class="notif-item-name">${escapeHtml(item.name || 'Tanpa Nama')}</span>
                            <span class="notif-tag notif-tag-fc">Fotocopy</span>
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
                    <a href="#" class="notif-btn-restock" title="Pergi ke form restock" onclick="event.preventDefault(); closeFcNotificationModal(); document.getElementById('fc-add-item-btn').click();">
                        Restock <i class="fas fa-chevron-right" style="font-size:10px;margin-left:4px;"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Inventory CRUD ───────────────────────────────────────────────────────────
const formFcInventory = document.getElementById('form-fc-inventory');
if (formFcInventory) {
    formFcInventory.addEventListener('submit', async e => {
        e.preventDefault();

        const idInput        = document.getElementById('fc-inv-id').value.trim();
        const nameInput      = document.getElementById('fc-inv-name').value.trim();
        const categoryInput  = document.getElementById('fc-inv-category').value;
        const buyPriceInput  = parseInt(document.getElementById('fc-inv-buy-price').value)  || 0;
        const sellPriceInput = parseInt(document.getElementById('fc-inv-sell-price').value) || 0;
        const stockInput     = parseInt(document.getElementById('fc-inv-stock').value)      || 0;

        if (!nameInput) { alert('Nama barang wajib diisi!'); return; }

        try {
            if (idInput) {
                // Edit mode
                const oldItem    = fcState.inventory.find(i => i.id === idInput);
                const addedStock = oldItem ? stockInput - (parseInt(oldItem.stock) || 0) : 0;

                await updateDoc(doc(db, "fotocopy_inventory", idInput), {
                    name:      nameInput,
                    category:  categoryInput,
                    buyPrice:  buyPriceInput,
                    sellPrice: sellPriceInput,
                    stock:     stockInput
                });

                if (addedStock > 0) {
                    await addDoc(collection(db, "fotocopy_expenses"), {
                        date:         getCurrentDateString(),
                        itemName:     nameInput,
                        qty:          addedStock,
                        buyPrice:     buyPriceInput,
                        totalExpense: addedStock * buyPriceInput
                    });
                }

                alert('Barang berhasil diperbarui!');

            } else {
                // Add new
                await addDoc(collection(db, "fotocopy_inventory"), {
                    name:      nameInput,
                    category:  categoryInput,
                    buyPrice:  buyPriceInput,
                    sellPrice: sellPriceInput,
                    stock:     stockInput
                });

                if (stockInput > 0) {
                    await addDoc(collection(db, "fotocopy_expenses"), {
                        date:         getCurrentDateString(),
                        itemName:     nameInput,
                        qty:          stockInput,
                        buyPrice:     buyPriceInput,
                        totalExpense: stockInput * buyPriceInput
                    });
                }

                alert('Barang berhasil ditambahkan!');
            }

            fcResetInventoryForm();

        } catch (err) {
            alert('Error: ' + err.message);
        }
    });
}

window.fcEditItem = function (id) {
    const item = fcState.inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('fc-form-title').innerHTML = '<i class="fas fa-edit text-amber-500 mr-2"></i>Edit Stok Barang Fotocopy';
    document.getElementById('fc-inv-id').value         = item.id;
    document.getElementById('fc-inv-name').value       = item.name;
    document.getElementById('fc-inv-category').value   = item.category || 'lainnya';
    document.getElementById('fc-inv-buy-price').value  = item.buyPrice;
    document.getElementById('fc-inv-sell-price').value = item.sellPrice;
    document.getElementById('fc-inv-stock').value      = item.stock;

    const btn = document.getElementById('fc-btn-save-item');
    btn.innerHTML   = '<i class="fas fa-save mr-2"></i>Update Barang';
    btn.className   = 'bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-5 rounded-lg transition-colors';

    document.getElementById('fc-btn-cancel-edit').classList.remove('hidden');

    // Switch to inventori tab
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-inventori').classList.add('active');
    document.getElementById('btn-tab-inventori').classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.fcDeleteItem = function (id) {
    if (confirm('Hapus barang ini dari inventori fotocopy?')) {
        deleteDoc(doc(db, "fotocopy_inventory", id)).catch(e => alert('Error: ' + e.message));
    }
};

window.fcResetInventoryForm = function () {
    if (!formFcInventory) return;
    formFcInventory.reset();
    document.getElementById('fc-inv-id').value = '';
    document.getElementById('fc-form-title').innerHTML = '<i class="fas fa-plus-circle text-violet-500 mr-2"></i>Tambah Stok Barang Fotocopy';
    const btn = document.getElementById('fc-btn-save-item');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Barang';
        btn.className = 'bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors';
    }
    document.getElementById('fc-btn-cancel-edit').classList.add('hidden');
};

// ── Export Excel ─────────────────────────────────────────────────────────────
window.fcExportExcel = function () {
    if (typeof XLSX === 'undefined') { alert('Library Excel belum dimuat.'); return; }
    if (fcState.transactions.length === 0 && fcState.inventory.length === 0) {
        alert('Tidak ada data untuk di-export.'); return;
    }

    const wb = XLSX.utils.book_new();

    if (fcState.transactions.length > 0) {
        const rows = [];
        fcState.transactions.forEach(t => {
            (t.items || [{ itemName: '-', qty: 0, sellPrice: 0, buyPrice: 0, subtotal: 0 }]).forEach(item => {
                rows.push({
                    Tanggal:          t.date,
                    Barang:           item.itemName,
                    Qty:              item.qty,
                    Harga_Jual:       item.sellPrice,
                    Subtotal_Item:    item.subtotal,
                    Subtotal_Txn:     t.subtotal,
                    Tipe_Diskon:      t.discountType || '-',
                    Nilai_Diskon:     t.discountInput || 0,
                    Nominal_Diskon:   t.discountAmount || 0,
                    Total_Bayar:      t.totalBayar,
                    Keuntungan_Bersih: t.netProfit
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transaksi Fotocopy');
    }

    if (fcState.expenses.length > 0) {
        const rows = fcState.expenses.map(e => ({
            Tanggal:       e.date,
            Nama_Barang:   e.itemName,
            Qty_Restock:   e.qty,
            Harga_Beli:    e.buyPrice,
            Total_Modal:   e.totalExpense
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pengeluaran Fotocopy');
    }

    if (fcState.inventory.length > 0) {
        const rows = fcState.inventory.map(i => ({
            Nama_Barang:        i.name,
            Kategori:           i.category || '-',
            Stok:               i.stock,
            Harga_Beli:         i.buyPrice,
            Harga_Jual:         i.sellPrice,
            Estimasi_Untung:    (i.sellPrice - i.buyPrice)
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stok Fotocopy');
    }

    XLSX.writeFile(wb, 'Laporan_Fotocopy.xlsx');
};

// ── Reset Transactions ────────────────────────────────────────────────────────
window.fcResetTransactions = async function () {
    const ok = confirm(
        'PERHATIAN!\n\nAnda akan menghapus seluruh riwayat transaksi fotocopy.\n' +
        'Pastikan sudah Export ke Excel terlebih dahulu.\n\nLanjutkan?'
    );
    if (!ok) return;
    try {
        const [txSnap, expSnap] = await Promise.all([
            getDocs(collection(db, "fotocopy_transactions")),
            getDocs(collection(db, "fotocopy_expenses"))
        ]);
        await Promise.all([
            ...txSnap.docs.map(d  => deleteDoc(doc(db, "fotocopy_transactions", d.id))),
            ...expSnap.docs.map(d => deleteDoc(doc(db, "fotocopy_expenses",     d.id)))
        ]);
        const notifArea = document.getElementById('fc-notification-area');
        if (notifArea) {
            notifArea.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:500;">
                <i class="fas fa-trash-alt" style="margin-right:6px;"></i>
                <strong>Reset selesai.</strong> Semua data transaksi dan pengeluaran fotocopy telah dihapus.
            </div>`;
        }
    } catch (err) {
        alert('Error saat reset: ' + err.message);
    }
};

// ── Init ──────────────────────────────────────────────────────────────────────
loadFcFirebase();
