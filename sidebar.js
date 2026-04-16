/**
 * sidebar.js — Sidebar compartido con sesión y logout
 * Uso: import { renderSidebar } from './sidebar.js';
 *      renderSidebar('mesas'); // 'mesas' | 'terminal' | 'analytics' | 'inventario'
 */
import { Session } from './session.js';

export function renderSidebar(activePage = '') {
  // Verificar sesión
  Session.require();

  const business = Session.getBusiness();
  const bizName  = business?.name || 'OnceyDoce';
  const initial  = Session.initial();
  const userName = Session.displayName();

  const nav = [
    { key: 'mesas',      href: 'index.html',    icon: 'deck',          label: 'Mesas'     },
    { key: 'terminal',   href: 'terminal.html',  icon: 'point_of_sale', label: 'Terminal'  },
    { key: 'analytics',  href: 'analytics.html', icon: 'analytics',     label: 'Analíticas'},
    { key: 'inventario', href: 'list-prod.html',  icon: 'inventory_2',   label: 'Inventario'},
  ];

  const navHTML = nav.map(item => {
    const isActive = item.key === activePage;
    return `
      <a class="flex items-center gap-3 px-4 py-3 ${isActive
        ? 'bg-white text-indigo-700 rounded-full font-bold shadow-sm'
        : 'text-slate-500 hover:text-indigo-600 hover:bg-white/60 rounded-full font-medium transition-colors'
      }" href="${item.href}">
        <span class="material-symbols-outlined" ${isActive ? "style=\"font-variation-settings:'FILL' 1;\"" : ''}>${item.icon}</span>
        <span class="font-headline">${item.label}</span>
      </a>`;
  }).join('');

  const sidebarHTML = `
    <aside class="h-screen w-64 fixed left-0 top-0 bg-slate-100 flex flex-col py-6 z-50" id="app-sidebar">
      <div class="px-6 mb-8 flex items-center gap-3">
        <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-white">restaurant</span>
        </div>
        <div>
          <h1 class="font-headline font-black text-xl text-indigo-700">${bizName}</h1>
          <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">OnceyDoce POS</p>
        </div>
      </div>
      <nav class="flex-1 space-y-1 px-2">
        ${navHTML}
      </nav>

      <!-- Usuario + logout -->
      <div class="px-4 mt-auto relative">
        <button id="user-menu-btn" onclick="toggleUserMenu()"
          class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/60 transition-colors cursor-pointer">
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            ${initial}
          </div>
          <div class="flex-1 text-left">
            <p class="text-xs font-bold text-slate-700 truncate">${userName}</p>
            <p class="text-[10px] text-slate-400">Ver opciones</p>
          </div>
          <span class="material-symbols-outlined text-slate-400 text-sm">expand_more</span>
        </button>

        <!-- Dropdown -->
        <div id="user-menu-dropdown"
          class="hidden absolute bottom-14 left-4 right-4 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          <div class="px-4 py-3 border-b border-slate-100">
            <p class="text-xs font-bold text-slate-700 truncate">${userName}</p>
            <p class="text-[10px] text-slate-400 truncate">${Session.getUser()?.email || ''}</p>
          </div>
          <button onclick="doLogout()"
            class="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold">
            <span class="material-symbols-outlined text-sm">logout</span>
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>`;

  // Insertar el sidebar como primer hijo del body
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // Agregar padding al body para compensar el sidebar
  document.body.style.paddingLeft = '';

  // Funciones globales para el menú
  window.toggleUserMenu = () => {
    const dropdown = document.getElementById('user-menu-dropdown');
    dropdown.classList.toggle('hidden');
  };

  window.doLogout = () => Session.logout();

  // Cerrar el dropdown si se hace click afuera
  document.addEventListener('click', (e) => {
    const btn      = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-menu-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}
