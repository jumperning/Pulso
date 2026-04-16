// main.js
import { Cart } from './src/components/Cart.js';
import { initDashboard } from './src/pages/dashboard.js';

// --- FUNCIONES GLOBALES ---
window.toggleModal = () => {
    const modal = document.getElementById('modal-new-table');
    if (modal) modal.classList.toggle('hidden');
};

window.updateItemQty = (id, change) => Cart.updateQty(id, change);

window.processOrder = async () => {
    console.log("Enviando pedido a NestJS...", Cart.items);
};

window.openTableDetail = async (tableName) => {
    const drawer = document.getElementById('global-cart-container');
    drawer.classList.remove('translate-x-full');
    console.log("Cargando mesa:", tableName);

    const API_URL     = 'http://localhost:3000';
    const business_id = localStorage.getItem('od_business_id') || '';
    const token       = localStorage.getItem('od_token') || '';

    try {
        const res = await fetch(`${API_URL}/orders/table/${tableName}`, {
            headers: {
                'x-business-id': business_id,
                'Authorization':  `Bearer ${token}`,
            },
        });
        const order = await res.json();

        Cart.items = (order.order_items || []).map(item => ({
            id:       item.product_id  || item.id,
            name:     item.products?.name  || item.product?.name  || 'Producto sin nombre',
            price:    parseFloat(item.products?.price || item.product?.price || 0),
            quantity: item.quantity,
        }));

        Cart.save();
    } catch (e) {
        console.error("Error al abrir detalle de mesa:", e);
    }
};

window.closeDrawer = () => {
    document.getElementById('global-cart-container').classList.add('translate-x-full');
};

const App = {
    init() {
        this.renderLayout();
        this.renderCartUI();
        window.addEventListener('cart-updated', () => this.renderCartUI());

        const path = window.location.pathname;
        if (path === '/' || path.includes('index.html')) {
            initDashboard();
        }

        console.log("App OnceyDoce inicializada correctamente");
    },

    renderLayout() {
        const cartContainer = document.getElementById('global-cart-container');
        if (cartContainer) {
            cartContainer.innerHTML = `
                <div class="px-6 py-8 border-b border-slate-100">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="font-headline font-black text-xl">Current Order</h2>
                        <button id="btn-clear" class="text-red-500 text-xs font-bold flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-full transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span> Clear
                        </button>
                    </div>
                </div>
                <div id="cart-list" class="flex-1 overflow-y-auto px-6 py-6 space-y-6 no-scrollbar"></div>
                <div id="cart-footer" class="p-6 bg-slate-50 border-t border-slate-200 shadow-2xl"></div>
            `;
            document.getElementById('btn-clear').onclick = () => Cart.clear();
        }
    },

    renderCartUI() {
        const listContainer   = document.getElementById('cart-list');
        const footerContainer = document.getElementById('cart-footer');
        if (!listContainer || !footerContainer) return;

        if (Cart.items.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
                    <span class="material-symbols-outlined text-5xl mb-2">shopping_basket</span>
                    <p class="text-xs font-bold uppercase tracking-widest">Carrito vacío</p>
                </div>`;
            footerContainer.innerHTML = '';
            return;
        }

        listContainer.innerHTML = Cart.items.map(item => `
            <div class="group animate-in fade-in duration-300">
                <div class="flex justify-between mb-3">
                    <div class="flex-1 text-left">
                        <p class="font-headline font-bold text-sm text-slate-800">${item.name}</p>
                    </div>
                    <p class="font-black text-slate-900 text-sm">$${(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-3 bg-slate-100 rounded-full p-1 w-fit">
                    <button class="w-7 h-7 bg-white rounded-full shadow-sm text-primary font-bold active:scale-90 transition-all" onclick="window.updateItemQty('${item.id}', -1)">-</button>
                    <span class="font-bold text-sm w-6 text-center">${item.quantity}</span>
                    <button class="w-7 h-7 bg-white rounded-full shadow-sm text-primary font-bold active:scale-90 transition-all" onclick="window.updateItemQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `).join('<div class="h-px bg-slate-100 my-4"></div>');

        const { total } = Cart.totals;
        footerContainer.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <span class="font-headline font-black text-lg text-slate-800 uppercase">Total</span>
                <span class="font-headline font-black text-2xl text-primary">$${total.toFixed(2)}</span>
            </div>
            <button onclick="window.processOrder()" class="w-full bg-primary text-white py-5 rounded-full font-headline font-black text-lg shadow-xl hover:-translate-y-1 active:translate-y-0.5 transition-all flex items-center justify-center gap-3">
                Confirmar Pedido <span class="material-symbols-outlined">arrow_forward</span>
            </button>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
