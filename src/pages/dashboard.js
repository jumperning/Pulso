// src/pages/dashboard.js
  const API_URL     = 'http://localhost:3000';
    business_idlocalStorage.getItem('od_business_id') || '';
    const token       = localStorage.getItem('od_token') || '';


export async function initDashboard() {
  await loadActiveTables();
}

export async function loadActiveTables() {
  try {
    const res = await fetch(`${API_URL}/orders/active`, {
      headers: { 'x-business-id': business_id }
    });
    if (!res.ok) throw new Error('API no disponible');
    const tables = await res.json();
    renderTables(tables);
  } catch (e) {
    console.warn('API offline, modo demo:', e.message);
    renderTables([
      { table_id: 'Mesa 1', total: 1450, item_count: 3 },
      { table_id: 'Mesa 2', total: 0, item_count: 0 },
      { table_id: 'Mesa 3', total: 870, item_count: 2 },
      { table_id: 'Barra', total: 350, item_count: 1 },
    ]);
  }
}

export function renderTables(tables) {
  const grid = document.getElementById('tables-grid');
  if (!grid) return;

  const occupied = tables.filter(t => t.total > 0);
  const badge = document.getElementById('active-badge');
  if (badge) badge.textContent = `${occupied.length} ${occupied.length === 1 ? 'mesa activa' : 'mesas activas'}`;

  const tablesHtml = tables.map(t => {
    const isOccupied = t.total > 0;
    return `
      <div onclick="window.openTableDetail('${t.table_id}')"
           class="table-card group relative bg-surface-container-lowest rounded-2xl p-6 cursor-pointer overflow-hidden min-h-[200px] flex flex-col justify-between">
        ${isOccupied ? `<div class="absolute top-0 left-0 w-1.5 h-full bg-secondary-container rounded-l-2xl"></div>` : ''}
        <div class="flex justify-between items-start">
          <div class="w-14 h-14 rounded-2xl ${isOccupied ? 'bg-primary/10' : 'bg-surface-container-high'} flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl ${isOccupied ? 'text-primary' : 'text-outline'}">table_restaurant</span>
          </div>
          <span class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
            ${isOccupied ? 'bg-secondary-container/20 text-on-secondary-container' : 'bg-tertiary/10 text-tertiary'}">
            ${isOccupied
              ? `<span class="w-1.5 h-1.5 rounded-full bg-secondary-container pulse-dot"></span> Activa`
              : `<span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Libre`}
          </span>
        </div>
        <div>
          <h4 class="text-lg font-headline font-extrabold text-on-surface mt-4">${t.table_id}</h4>
          <p class="text-sm text-on-surface-variant mt-0.5">${isOccupied ? `${t.item_count || ''} productos` : 'Disponible'}</p>
        </div>
        <div class="flex justify-between items-center pt-4 border-t border-outline-variant/20 mt-4">
          <span class="font-headline font-black ${isOccupied ? 'text-primary text-lg' : 'text-outline text-sm'}">
            ${isOccupied ? `$${t.total.toLocaleString('es-AR')}` : '—'}
          </span>
          <span class="material-symbols-outlined ${isOccupied ? 'text-secondary' : 'text-outline'} group-hover:text-primary transition-colors">arrow_forward</span>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = tablesHtml;
}