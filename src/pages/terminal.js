 const API_URL = 'https://pulsoback.onrender.com';

  const token      = localStorage.getItem('od_token');
  const businessId = localStorage.getItem('od_business_id');
  if (!token || !businessId) { window.location.href = 'setup.html'; }

  const HEADERS      = { 'x-business-id': businessId, 'Authorization': `Bearer ${token}` };
  const JSON_HEADERS = { 'Content-Type': 'application/json', ...HEADERS };

  // ── STATE ──────────────────────────────────────────────────────────────
  let allProducts       = [];
  let activeCategory    = 'Todos';
  let cartItems         = [];
  let currentTable      = null;
  let currentOrderId    = null;
  let currentOrderStatus = null;   // null | 'pending' | 'open' | 'closed'
  let currentOrderCreatedAt = null; // Date ISO para el timer de 15 min
  let activeTables      = [];
  let alert15Shown      = false;   // evita mostrar la alerta múltiples veces

  // ── BOTONES SEGÚN ESTADO ───────────────────────────────────────────────
  function updateCartButtons() {
    const isNew     = !currentOrderId || currentOrderStatus === null;
    const isPending = currentOrderId && currentOrderStatus === 'pending';
    const isOpen    = currentOrderId && currentOrderStatus === 'open';

    document.getElementById('btn-section-new').classList.toggle('hidden', !isNew);
    document.getElementById('btn-section-pending').classList.toggle('hidden', !isPending);
    document.getElementById('btn-section-open').classList.toggle('hidden', !isOpen);
    document.getElementById('btn-print-comanda').classList.toggle('hidden', isNew);

    // Badge de estado
    const badge = document.getElementById('order-status-badge');
    const stateCfg = {
      pending: { text: '⏳ Pendiente',  cls: 'bg-amber-100 text-amber-800' },
      open:    { text: '✅ Activo',      cls: 'bg-green-100 text-green-800' },
      closed:  { text: '💳 Cerrado',    cls: 'bg-blue-100 text-blue-800'  },
    };
    const cfg = stateCfg[currentOrderStatus];
    if (cfg) {
      badge.textContent = cfg.text;
      badge.className   = `px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // ── ALERTA 15 MIN ──────────────────────────────────────────────────────
  // Se chequea cada 60 seg. Controla tanto la orden abierta en terminal
  // como otras mesas pendientes cargadas en activeTables.
  function checkPendingAlerts() {
    const now = Date.now();

    // 1) Orden actualmente abierta en esta terminal
    if (
      currentOrderId &&
      currentOrderStatus === 'pending' &&
      currentOrderCreatedAt &&
      !alert15Shown
    ) {
      const diffMs = now - new Date(currentOrderCreatedAt).getTime();
      if (diffMs >= 15 * 60 * 1000) {
        alert15Shown = true;
        showAlert15(currentTable, currentOrderId, true /* es la orden actual */);
        return; // mostramos una alerta a la vez
      }
    }

    // 2) Otras mesas pendientes del backend (que no son la actual)
    for (const order of activeTables) {
      if (order.status !== 'pending') continue;
      if (order.id === currentOrderId) continue;
      if (order._alertShown) continue;
      const diffMs = now - new Date(order.created_at).getTime();
      if (diffMs >= 15 * 60 * 1000) {
        order._alertShown = true;
        showAlert15(order.table_id, order.id, false);
        break; // una a la vez
      }
    }
  }

  function showAlert15(tableName, orderId, isCurrentOrder) {
    document.getElementById('alert-15min-text').textContent =
      `La mesa "${tableName}" lleva más de 15 min sin entregar. ¿Ya se entregó el pedido?`;
    document.getElementById('alert-15min').dataset.orderId       = orderId;
    document.getElementById('alert-15min').dataset.isCurrentOrder = isCurrentOrder ? '1' : '0';
    document.getElementById('alert-15min').classList.remove('hidden');
  }

  window.alertConfirmDelivered = async () => {
    const alertEl = document.getElementById('alert-15min');
    const orderId = alertEl.dataset.orderId;
    const isCurrent = alertEl.dataset.isCurrentOrder === '1';
    alertEl.classList.add('hidden');

    try {
      await fetch(`${API_URL}/orders/${orderId}/mark-delivered`, {
        method: 'PATCH', headers: HEADERS,
      });
      if (isCurrent) {
        currentOrderStatus = 'open';
        updateCartButtons();
      }
      showToast('ok', '✓ Pedido marcado como entregado');
      await loadActiveTables();
    } catch (e) {
      showToast('warn', 'Error actualizando estado');
    }
  };

  window.alertDismiss = () => {
    document.getElementById('alert-15min').classList.add('hidden');
    // Volvemos a chequear en el próximo ciclo sin marcarla como mostrada,
    // para que salte de nuevo en 1 min si sigue pendiente.
    // Si querés que NO vuelva a molestar, descomentá la línea de abajo:
    // alert15Shown = true;
  };

  setInterval(checkPendingAlerts, 60_000);

  // ── MODAL DE MESA ──────────────────────────────────────────────────────
  window.openTableModal = () => {
    const modal = document.getElementById('modal-table');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('btn-close-modal').classList.toggle('hidden', !currentTable);
    renderActiveTablesInModal();
    setTimeout(() => document.getElementById('input-table-name').focus(), 50);
  };

  window.closeTableModal = () => {
    document.getElementById('modal-table').classList.add('hidden');
    document.getElementById('modal-table').classList.remove('flex');
  };

  function renderActiveTablesInModal() {
    const section = document.getElementById('active-tables-section');
    const grid    = document.getElementById('active-tables-grid');
    if (activeTables.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    grid.innerHTML = activeTables.map(t => {
      const statusIcon = t.status === 'pending' ? '⏳' : '✅';
      return `
        <button onclick="pickQuick('${t.table_id}')"
          class="quick-btn active-table flex items-center gap-2 px-4 py-2 rounded-full text-xs font-headline font-bold">
          <span class="material-symbols-outlined text-sm">table_restaurant</span>
          ${statusIcon} ${t.table_id}
          <span class="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-black">
            $${(t.total || 0).toLocaleString('es-AR')}
          </span>
        </button>`;
    }).join('');
  }

  window.pickQuick = (name) => {
    document.getElementById('input-table-name').value = name;
    confirmTableSelection();
  };

 window.confirmTableSelection = async () => {
  const name = document.getElementById('input-table-name').value.trim();
  if (!name) {
    document.getElementById('input-table-name').focus();
    showToast('warn', 'Ingresá el nombre de la mesa');
    return;
  }

  closeTableModal();
  document.getElementById('input-table-name').value = '';

  currentTable = name;
  cartItems = [];
  alert15Shown = false;

  try {
    // 1. Buscar orden existente
    let res = await fetch(`${API_URL}/orders/table/${encodeURIComponent(name)}`, { headers: HEADERS });

    let order;

    if (res.status === 404) {
      // 2. Si no existe → CREARLA
      const createRes = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ table_id: name })
      });

      order = await createRes.json();
    } else {
      order = await res.json();
    }

    currentOrderId        = order.id;
    currentOrderStatus    = order.status;
    currentOrderCreatedAt = order.created_at;

    document.getElementById('order-id').textContent =
      `#${order.id.slice(-6).toUpperCase()}`;

    cartItems = (order.order_items || []).map(item => ({
      id: item.product_id,
      itemId: item.id,
      name: item.products?.name || 'Producto',
      price: parseFloat(item.products?.price || 0),
      quantity: item.quantity,
    }));

    updateTableBadges();
    renderCartUI();
    updateCartButtons();

    showToast('ok', `Mesa: ${name}`);
  } catch (e) {
    console.error(e);
    showToast('warn', 'Error abriendo mesa');
  }
};

  function updateTableBadges() {
    const label = currentTable || 'Sin Mesa';
    document.getElementById('current-table-label').textContent = label;
    document.getElementById('display-table').textContent = label;
  }

  // ── PRODUCTOS ──────────────────────────────────────────────────────────
  async function loadProducts() {
    if (!businessId || businessId === 'null' || businessId === 'undefined') return;
    try {
      const res = await fetch(`${API_URL}/products`, { headers: HEADERS });
      if (!res.ok) throw new Error();
      allProducts = await res.json();
    } catch {
      allProducts = [];
    }
    renderCategories();
    renderProducts(allProducts);
  }

  async function loadActiveTables() {
    try {
      const res = await fetch(`${API_URL}/orders/active`, { headers: HEADERS });
      if (!res.ok) throw new Error();
      activeTables = await res.json();
    } catch {
      activeTables = [];
    }
  }

  function renderCategories() {
    const cats = ['Todos', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    document.getElementById('category-filters').innerHTML = cats.map(cat => `
      <button onclick="setCategory('${cat}')"
        class="cat-btn flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-headline font-bold transition-all
          ${cat === activeCategory
            ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}">
        ${cat}
      </button>`).join('');
  }

  window.setCategory = (cat) => {
    activeCategory = cat;
    renderCategories();
    renderProducts(cat === 'Todos' ? allProducts : allProducts.filter(p => p.category === cat));
  };

  window.filterProducts = () => {
    const q = document.getElementById('search-input').value.toLowerCase();
    renderProducts(allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    ));
  };

  function renderProducts(products) {
  const favorites = allProducts.filter(p => p.is_favorite === true);
  const main      = products.filter(p => !p.is_favorite);

  // FAVORITOS
  document.getElementById('favorites-grid').innerHTML = favorites.length === 0
    ? `<p class="text-sm text-outline italic">Sin favoritos en esta categoría</p>`
    : favorites.map(p => `
      <div data-id="${p.id}"
           class="product-card flex-shrink-0 w-44 bg-surface-container-lowest p-3 rounded-2xl shadow-sm border border-outline-variant/10 cursor-pointer hover:shadow-xl transition-all">
        
        <div class="relative mb-3">
          <div class="w-full h-28 bg-surface-container rounded-xl flex items-center justify-center">
            <span class="material-symbols-outlined text-4xl text-outline">restaurant</span>
          </div>

          <div class="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full p-1.5 shadow-sm">
            <span class="material-symbols-outlined text-xs text-amber-500" style="font-variation-settings:'FILL' 1;">star</span>
          </div>
        </div>

        <p class="font-headline font-bold text-sm text-on-surface leading-tight mb-1">
          ${p.name}
        </p>

        <div class="flex items-center justify-between">
          <p class="text-primary font-black text-sm">
            $${p.price.toLocaleString('es-AR')}
          </p>

          <span class="flex items-center gap-1 text-[10px] ${p.stock > 0 ? 'text-tertiary' : 'text-error'} font-bold">
            <span class="w-1.5 h-1.5 rounded-full ${p.stock > 0 ? 'bg-tertiary' : 'bg-error'}"></span>
            ${p.stock > 0 ? p.stock : 'Sin stock'}
          </span>
        </div>
      </div>
    `).join('');

  // MAIN GRID
  const mainGrid = document.getElementById('main-grid');

  if (main.length === 0) {
    mainGrid.innerHTML = `
      <div class="col-span-3 text-center py-12 text-outline">
        <span class="material-symbols-outlined text-4xl mb-2 block">search_off</span>
        <p class="font-bold">Sin resultados</p>
      </div>`;
  } else {
    mainGrid.innerHTML = main.map(p => {
      const oos = p.stock === 0;

      return `
        <div data-id="${p.id}"
             class="product-card bg-surface-container-lowest rounded-2xl overflow-hidden ${oos ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} hover:shadow-xl transition-all">
          
          <div class="h-40 relative bg-surface-container flex items-center justify-center">
            <span class="material-symbols-outlined text-5xl text-outline/40">restaurant</span>

            <div class="absolute top-3 right-3 ${oos ? 'bg-error-container/80' : 'bg-white/90'} backdrop-blur rounded-full px-3 py-1 text-[10px] font-bold ${oos ? 'text-on-error-container' : 'text-on-surface'} shadow-sm">
              ${oos ? 'Sin stock' : p.stock + ' en stock'}
            </div>

            ${oos ? `
              <div class="absolute inset-0 bg-on-surface/30 flex items-center justify-center">
                <span class="bg-white text-on-surface px-4 py-1.5 rounded-full font-headline font-bold text-xs uppercase">
                  Agotado
                </span>
              </div>` : ''}
          </div>

          <div class="p-4">
            <p class="font-headline font-bold text-base text-on-surface mb-0.5">
              ${p.name}
            </p>

            ${p.category ? `<p class="text-xs text-on-surface-variant">${p.category}</p>` : ''}

            <div class="flex items-center justify-between mt-4">
              <p class="text-lg font-black ${oos ? 'text-outline' : 'text-primary'}">
                $${p.price.toLocaleString('es-AR')}
              </p>

              <button class="w-10 h-10 ${oos ? 'bg-surface-container text-outline cursor-not-allowed' : 'bg-secondary-container text-on-secondary-container hover:bg-primary hover:text-on-primary'} rounded-full flex items-center justify-center transition-all active:scale-90">
                <span class="material-symbols-outlined">
                  ${oos ? 'block' : 'add'}
                </span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 🔥 IMPORTANTE: bindear eventos después de renderizar
  bindProductEvents();
}

function bindProductEvents() {
  document.querySelectorAll('.product-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      addToCart(id);
    });
  });
}

  // ── CARRITO ────────────────────────────────────────────────────────────
async function addToCart(productId) {
 
  if (!currentTable) {
    showToast('warn', 'Primero seleccioná una mesa');
    openTableModal();
    return;
  }

  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product || product.stock <= 0) {
    showToast('warn', 'Producto sin stock');
    return;
  }

  // Optimistic update
  let existing = cartItems.find(i => i.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cartItems.push({
      id: product.id,
      itemId: null,           // se completará con la respuesta del backend
      name: product.name,
      price: parseFloat(product.price),
      quantity: 1,
      note: null
    });
  }

  renderCartUI();

  try {
    const res = await fetch(`${API_URL}/orders/add-item`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        tableId: currentTable,
        productId: product.id,
        quantity: 1
      })
    });

    if (!res.ok) throw new Error('Error al agregar');

    const result = await res.json();

    // Guardar el itemId real devuelto por Supabase
    const newItem = cartItems.find(i => i.id === product.id);
    if (newItem && result.data?.id) {
      newItem.itemId = result.data.id;
    }

    showToast('ok', `+ ${product.name}`);
  } catch (error) {
    console.error(error);
    // Revertir optimistic update
    const idx = cartItems.findIndex(i => i.id === product.id);
    if (idx !== -1) {
      if (cartItems[idx].quantity > 1) cartItems[idx].quantity -= 1;
      else cartItems.splice(idx, 1);
    }
    renderCartUI();
    showToast('warn', 'No se pudo agregar el producto');
  }
}

// Actualizar cantidad
export async function updateQty(itemId, newQty) {
  if (!itemId) return;

  const cartItem = cartItems.find(i => i.itemId === itemId);
  if (!cartItem) return;

  const oldQty = cartItem.quantity;

  // Optimistic
  if (newQty <= 0) {
    cartItems = cartItems.filter(i => i.itemId !== itemId);
  } else {
    cartItem.quantity = newQty;
  }
  renderCartUI();

  try {
    if (newQty <= 0) {
      await fetch(`${API_URL}/orders/item/${itemId}`, {
        method: 'DELETE',
        headers: HEADERS
      });
    } else {
      await fetch(`${API_URL}/orders/item/${itemId}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ quantity: newQty })
      });
    }
  } catch (e) {
    console.error(e);
    // Revertir
    if (newQty <= 0) {
      cartItems.push({ ...cartItem, quantity: oldQty });
    } else {
      const item = cartItems.find(i => i.itemId === itemId);
      if (item) item.quantity = oldQty;
    }
    renderCartUI();
    showToast('warn', 'Error al actualizar cantidad');
  }
}

// Limpiar carrito
export async function clearCart() {
  if (cartItems.length === 0) return;

  const toDelete = [...cartItems];
  cartItems = [];
  renderCartUI();

  try {
    await Promise.all(
      toDelete
        .filter(i => i.itemId)
        .map(i => fetch(`${API_URL}/orders/item/${i.itemId}`, {
          method: 'DELETE',
          headers: HEADERS
        }))
    );
  } catch (e) {
    console.error('Error limpiando carrito', e);
  }
}
  // ── RENDER CARRITO ─────────────────────────────────────────────────────
  function renderCartUI() {
  const listEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('total');

  if (cartItems.length === 0) {
    listEl.innerHTML = `<div class="text-center py-10 opacity-50">Carrito vacío</div>`;
    return;
  }

  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  listEl.innerHTML = cartItems.map(item => `
    <div class="group border-b border-outline-variant/10 pb-3">
      <div class="flex justify-between mb-1">
        <p class="font-bold text-sm">${item.name}</p>
        <p class="font-black text-sm">$${(item.price * item.quantity).toLocaleString('es-AR')}</p>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button onclick="updateQty('${item.itemId}', ${item.quantity - 1})" class="w-6 h-6 bg-surface-container rounded-full">-</button>
          <span class="text-sm font-bold">${item.quantity}</span>
          <button onclick="updateQty('${item.itemId}', ${item.quantity + 1})" class="w-6 h-6 bg-surface-container rounded-full">+</button>
        </div>
        <button onclick="addNote('${item.id}')" class="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">
          ${item.note ? '📝 Ver Nota' : '+ Nota'}
        </button>
      </div>
      ${item.note ? `<p class="text-[10px] text-amber-600 mt-1 italic">"${item.note}"</p>` : ''}
    </div>`).join('');

  totalEl.textContent = `$${total.toLocaleString('es-AR')}`;
}

// Función para capturar la nota
window.addNote = (itemId) => {
  const item = cartItems.find(i => i.itemId === id);
  const note = prompt("Instrucciones especiales (ej: sin aderezo, trago suave):", item.note || "");
  if (note !== null) {
    item.note = note;
    renderCartUI();
  }
};

  // ── FLUJO DE ESTADOS ───────────────────────────────────────────────────

  // PASO 1 — Confirmar pedido → pending (ya estaba en pending desde que se creó,
  // esto solo confirma visualmente y deja de permitir edición si quisieras)
  window.confirmOrder = async () => {
    if (!currentTable)          { showToast('warn', 'Seleccioná una mesa primero'); return; }
    if (cartItems.length === 0) { showToast('warn', 'Agregá productos primero'); return; }
    if (!currentOrderId)        { showToast('warn', 'No hay orden activa'); return; }

    // La orden ya existe en la BD como 'pending'. Solo cambiamos la UI.
    currentOrderStatus = 'pending';
    updateCartButtons();
    showToast('ok', `✓ Pedido de ${currentTable} enviado a cocina`);
    await loadActiveTables();
  };

  // PASO 2 — Marcar como entregado → open
  window.markCurrentOrderDelivered = async () => {
    if (!currentOrderId) return;
    try {
      const res = await fetch(`${API_URL}/orders/${currentOrderId}/mark-delivered`, {
        method: 'PATCH', headers: HEADERS,
      });
      if (!res.ok) throw new Error();
      currentOrderStatus = 'open';
      alert15Shown = true; // ya no necesitamos la alerta
      document.getElementById('alert-15min').classList.add('hidden');
      updateCartButtons();
      showToast('ok', '✓ Pedido entregado al cliente');
      await loadActiveTables();
    } catch {
      showToast('warn', 'Error actualizando estado');
    }
  };

  // PASO 3 — Cerrar mesa / Cobrar → closed
  window.closeCurrentOrder = async () => {
    const wantTicket = confirm('¿Querés imprimir el ticket para el cliente?');
    if (wantTicket) printTicket();

    const paymentMethod = document.getElementById('payment-method')?.value || 'cash';
    try {
      const res = await fetch(`${API_URL}/orders/close/${currentOrderId}`, {
        method: 'POST', headers: JSON_HEADERS,
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showToast('warn', 'Error cerrando orden'); return;
    }

    showToast('ok', `✓ Mesa ${currentTable} cerrada`);
    cartItems             = [];
    currentTable          = null;
    currentOrderId        = null;
    currentOrderStatus    = null;
    currentOrderCreatedAt = null;
    alert15Shown          = false;
    updateTableBadges();
    updateCartButtons();
    document.getElementById('order-id').textContent = '#NUEVA';
    renderCartUI();
    await loadActiveTables();
    setTimeout(() => openTableModal(), 1400);
  };

  // ── IMPRESIÓN ──────────────────────────────────────────────────────────
// Abrir el nuevo modal en lugar de usar confirm/alert
window.printComanda = () => {
  if (!currentOrderId || cartItems.length === 0) {
    showToast('warn', 'No hay productos para imprimir');
    return;
  }
  document.getElementById('modal-print').classList.remove('hidden');
};

window.closePrintModal = () => {
  document.getElementById('modal-print').classList.add('hidden');
};

// Función que ejecuta la impresión real basada en la selección
window.executePrint = (type) => {
  closePrintModal();

  // Cálculo de tiempo
  const start = new Date(currentOrderCreatedAt);
  const now = new Date();
  const diffMin = Math.floor((now - start) / 60000);

  // Filtrado por categoría
  let filteredItems = cartItems;
  if (type === 'comida') {
    filteredItems = cartItems.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return cat.includes('cocina') || cat.includes('comida') || cat.includes('hamburguesa');
    });
  } else if (type === 'bebida') {
    filteredItems = cartItems.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return cat.includes('barra') || cat.includes('bebida') || cat.includes('cerveza') || cat.includes('trago');
    });
  }

  if (filteredItems.length === 0) {
    showToast('warn', `No hay items de tipo ${type}`);
    return;
  }

  // Generación de líneas con notas
  const lines = filteredItems.map(i => {
    let line = `${i.quantity}x ${i.name.toUpperCase()}`;
    if (i.note) line += `\n   (!) NOTA: ${i.note}`;
    return line;
  }).join('\n');

  // Ventana de impresión
  const win = window.open('', '_blank', 'width=340,height=600');
  win.document.write(`
    <html>
    <body style="font-family:monospace; padding:20px; font-size:14px;">
      <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:10px; margin-bottom:15px;">
        <h3 style="margin:0;">COMANDA</h3>
        <h1 style="margin:5px 0; font-size:28px;">${currentTable}</h1>
        <p style="margin:0;">Reloj: <b>+ ${diffMin} min</b></p>
      </div>
      <pre style="white-space:pre-wrap; font-weight:bold; line-height:1.4;">${lines}</pre>
      <div style="text-align:center; border-top:1px dashed #000; margin-top:20px; padding-top:10px; font-size:10px;">
        ${now.toLocaleTimeString('es-AR')} | SECCIÓN: ${type.toUpperCase()}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 250);
};

// Función mejorada para notas (puedes integrarla al renderCartUI)
window.addNote = (itemId) => {
  const item = cartItems.find(i => i.id === itemId);
  const newNote = prompt("Nota para cocina/barra:", item.note || "");
  if (newNote !== null) {
    item.note = newNote;
    renderCartUI();
  }
};

  function printTicket() {
    const lines = cartItems.map(i => {
      const name  = i.name.substring(0, 22).padEnd(22,' ');
      const price = `$${(i.price * i.quantity).toLocaleString('es-AR')}`;
      return `${i.quantity}x ${name} ${price}`;
    }).join('\n');
    const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const payMethod = document.getElementById('payment-method')?.value || 'cash';
    const payLabels = { cash: 'Efectivo', card: 'Tarjeta', qr: 'QR / Transferencia' };
    const win = window.open('', '_blank', 'width=340,height=600');
    win.document.write(`<!DOCTYPE html><html><body style="font-family:monospace;padding:24px;margin:0">
      <h2 style="text-align:center;margin:0 0 4px">OnceyDoce</h2>
      <p style="text-align:center;font-size:12px;color:#666;margin:0 0 2px">Bar & Café</p>
      <p style="text-align:center;font-size:13px;margin:0 0 2px"><b>${currentTable}</b></p>
      <p style="text-align:center;font-size:11px;color:#666;margin:0 0 12px">${new Date().toLocaleString('es-AR')}</p>
      <hr style="border:1px dashed #000;margin:8px 0">
      <pre style="font-size:13px;line-height:1.8;margin:12px 0">${lines}</pre>
      <hr style="border:1px dashed #000;margin:8px 0">
      <p style="text-align:right;font-size:18px;margin:8px 0"><b>TOTAL: $${total.toLocaleString('es-AR')}</b></p>
      <p style="text-align:right;font-size:12px;color:#666;margin:0 0 16px">Pago: ${payLabels[payMethod] || payMethod}</p>
      <hr style="border:1px dashed #000;margin:8px 0">
      <p style="text-align:center;font-size:12px;margin:12px 0">¡Gracias por tu visita!</p>
    </body></html>`);
    win.document.close();
    win.print();
  }

  // ── TOAST ──────────────────────────────────────────────────────────────
  function showToast(type, msg) {
    const toast = document.getElementById('toast');
    const icons = { ok: 'check_circle', warn: 'warning', add: 'add_circle' };
    toast.innerHTML = `<span class="material-symbols-outlined text-sm">${icons[type] || 'info'}</span>${msg}`;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.style.opacity = '0', 2500);
  }

  // ── KEYBOARD ───────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && currentTable) closeTableModal();
    if (e.key === 'Enter' && document.activeElement?.id === 'input-table-name') confirmTableSelection();
  });

  // ── SESIÓN UI ──────────────────────────────────────────────────────────
  (function initSessionUI() {
    try {
      const user = JSON.parse(localStorage.getItem('od_user') || 'null');
      if (!user) return;
      const name    = `${user.firstName||''} ${user.lastName||''}`.trim() || user.email || 'Usuario';
      const initial = (name[0] || 'U').toUpperCase();
      document.getElementById('sidebar-initial').textContent = initial;
      document.getElementById('sidebar-name').textContent    = name;
      document.getElementById('dropdown-name').textContent   = name;
      document.getElementById('dropdown-email').textContent  = user.email || '';
    } catch {}
  })();

  window.toggleUserMenu = () => document.getElementById('user-menu-dropdown').classList.toggle('hidden');
  window.doLogout = async () => {
    try { await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: HEADERS }); } catch {}
    ['od_token','od_user','od_business_id','od_business','od_products',
     'od_team_invites','od_setup_complete','onceydoce_config']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = 'setup.html';
  };
  document.addEventListener('click', e => {
    const btn = document.getElementById('user-menu-btn');
    const dd  = document.getElementById('user-menu-dropdown');
    if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) dd.classList.add('hidden');
  });

  // Click fuera del modal → cerrar
  document.getElementById('modal-table').addEventListener('click', (e) => {
    if (!document.getElementById('modal-content').contains(e.target)) {
      if (!currentTable) return; // si no hay mesa, no se puede cerrar
      closeTableModal();
    }
  });

  // ── INIT ───────────────────────────────────────────────────────────────
  await Promise.all([loadProducts(), loadActiveTables()]);
  renderCartUI();
  updateCartButtons();
  openTableModal();
