// src/components/Cart.js

export const Cart = {
  items: [],

  // Carga desde localStorage (útil para persistir entre recargas)
  load() {
    const data = localStorage.getItem('onceydoce_cart');
    this.items = data ? JSON.parse(data) : [];
  },

  // Reemplaza el carrito completo (ej: al abrir una mesa desde el server)
  setItems(newItems) {
    this.items = newItems;
    this.save();
  },

  add(product) {
    const existing = this.items.find(item => item.id === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.items.push({ ...product, quantity: 1 });
    }
    this.save();
  },

  updateQty(id, change) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.quantity += change;
      if (item.quantity <= 0) {
        this.items = this.items.filter(i => i.id !== id);
      }
      this.save();
    }
  },

  clear() {
    this.items = [];
    this.save();
  },

  save() {
    localStorage.setItem('onceydoce_cart', JSON.stringify(this.items));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  },

  get totals() {
    const subtotal = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return { subtotal, total: subtotal };
  }
};