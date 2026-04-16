/**
 * session.js — Módulo compartido de sesión para OnceyDoce POS
 * Importar en cada página con: import { Session } from './session.js';
 */

export const Session = {
  API_URL: 'https://pulsoback.onrender.com/',

  /** Lee el token guardado */
  getToken() {
    return localStorage.getItem('od_token');
  },

  /** Lee el business_id guardado */
  getBusinessId() {
    return localStorage.getItem('od_business_id');
  },

  /** Lee el objeto negocio completo */
  getBusiness() {
    try {
      return JSON.parse(localStorage.getItem('od_business') || 'null');
    } catch { return null; }
  },

  /** Lee el usuario */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('od_user') || 'null');
    } catch { return null; }
  },

  /** Verifica que haya sesión activa; si no, redirige a setup */
  require() {
    const token      = this.getToken();
    const businessId = this.getBusinessId();
    if (!token || !businessId) {
      window.location.href = 'setup.html';
      return false;
    }
    return true;
  },

  /** Headers HTTP comunes */
  headers(json = false) {
    const h = {
      'x-business-id': this.getBusinessId() || '',
      'Authorization':  `Bearer ${this.getToken() || ''}`,
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },

  /** Guarda todos los datos de sesión tras login / register */
  save({ token, user, businessId, business }) {
    if (token)      localStorage.setItem('od_token',       token);
    if (user)       localStorage.setItem('od_user',        JSON.stringify(user));
    if (businessId) localStorage.setItem('od_business_id', businessId);
    if (business)   localStorage.setItem('od_business',    JSON.stringify(business));
  },

  /** Cierra sesión: llama al backend y limpia localStorage */
  async logout() {
    const token = this.getToken();
    try {
      await fetch(`${this.API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token || ''}` },
      });
    } catch (e) {
      console.warn('Logout backend error (ignored):', e.message);
    }
    // Limpiar todo
    ['od_token', 'od_user', 'od_business_id', 'od_business',
     'od_products', 'od_team_invites', 'od_setup_complete', 'onceydoce_config']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = 'setup.html';
  },

  /** Nombre para mostrar del usuario actual */
  displayName() {
    const u = this.getUser();
    if (!u) return 'Usuario';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Usuario';
  },

  /** Inicial del usuario para el avatar */
  initial() {
    const name = this.displayName();
    return (name[0] || 'U').toUpperCase();
  },
};
