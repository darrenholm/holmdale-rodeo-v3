import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const API_URL = import.meta.env.VITE_RAILWAY_API_URL || 'https://rodeo-fresh-production-7348.up.railway.app/api';

export default function FoodOrder() {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState({});
  const [boothName, setBoothName] = useState('RODEO GRUB');
  const [taxRate, setTaxRate] = useState(0.13);
  const [taxLabel, setTaxLabel] = useState('HST');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('menu'); // menu, cart, checkout, success
  const [orderNumber, setOrderNumber] = useState('');
  const [paying, setPaying] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [error, setError] = useState('');

  // Load menu from API
  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    try {
      const res = await fetch(`${API_URL}/booth/menu`);
      const data = await res.json();
      if (data?.menu?.length) {
        setMenu(data.menu.filter(i => !i.soldOut));
        setCategories(data.categories || []);
        if (data.boothName) setBoothName(data.boothName);
        if (data.taxRate) setTaxRate(data.taxRate);
        if (data.taxLabel) setTaxLabel(data.taxLabel);
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredMenu = useMemo(() => {
    if (activeCategory === 'all') return menu;
    return menu.filter(i => i.cat === activeCategory);
  }, [menu, activeCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menu.find(i => i.id === id);
        return item ? { ...item, qty } : null;
      })
      .filter(Boolean);
  }, [cart, menu]);

  const subtotal = useMemo(() => cartItems.reduce((sum, i) => sum + i.price * i.qty, 0), [cartItems]);
  const tax = useMemo(() => subtotal * taxRate, [subtotal, taxRate]);
  const total = subtotal + tax;
  const itemCount = Object.values(cart).reduce((s, q) => s + q, 0);

  function addToCart(id) {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function removeFromCart(id) {
    setCart(prev => {
      const next = { ...prev };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });
  }

  function clearCart() {
    setCart({});
    setScreen('menu');
  }

  async function handleCheckout() {
    if (!customerName.trim()) { setError('Please enter your name'); return; }
    setError('');
    setPaying(true);

    try {
      const items = cartItems.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.qty,
      }));

      const res = await fetch(`${API_URL}/moneris/food-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          subtotal,
          tax,
          total,
          taxLabel,
        }),
      });

      const data = await res.json();

      if (data.ticket) {
        // Redirect to Moneris checkout
        window.location.href = `https://gateway.moneris.com/chktv2/index.php?ticket=${data.ticket}`;
      } else if (data.orderNumber) {
        // Direct success (free items or test mode)
        setOrderNumber(data.orderNumber);
        setScreen('success');
      } else {
        setError(data.error || 'Checkout failed. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Checkout error:', err);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-stone-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur border-b border-stone-800">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-100 tracking-wide">{boothName}</h1>
            <p className="text-xs text-green-500 font-semibold tracking-widest uppercase">Order from your phone</p>
          </div>
          {itemCount > 0 && screen === 'menu' && (
            <button
              onClick={() => setScreen('cart')}
              className="relative bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              View Order
              <span className="absolute -top-2 -right-2 bg-stone-100 text-stone-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            </button>
          )}
          {screen !== 'menu' && screen !== 'success' && (
            <button
              onClick={() => setScreen('menu')}
              className="text-stone-400 hover:text-stone-200 font-semibold text-sm"
            >
              ← Back to Menu
            </button>
          )}
        </div>
      </div>

      {/* MENU SCREEN */}
      {screen === 'menu' && (
        <div className="max-w-xl mx-auto px-4 pb-28">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                activeCategory === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  activeCategory === c.key
                    ? 'bg-green-600 text-white'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="space-y-3">
            {filteredMenu.map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-4"
                >
                  <span className="text-3xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-100 text-sm">{item.name}</span>
                      {item.popular && (
                        <span className="text-[10px] font-bold bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">Popular</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{item.desc}</p>
                    <p className="text-green-400 font-bold text-sm mt-1">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 font-bold text-lg flex items-center justify-center hover:bg-stone-700"
                        >
                          −
                        </button>
                        <span className="text-stone-100 font-bold w-6 text-center">{qty}</span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(item.id)}
                      className="w-8 h-8 rounded-full bg-green-600 text-white font-bold text-lg flex items-center justify-center hover:bg-green-500"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Cart Bar */}
          {itemCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 p-4 md:max-w-xl md:mx-auto">
              <button
                onClick={() => setScreen('cart')}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-bold text-base transition-colors flex items-center justify-between px-6"
              >
                <span>View Order ({itemCount} items)</span>
                <span>${total.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* CART SCREEN */}
      {screen === 'cart' && (
        <div className="max-w-xl mx-auto px-4 py-6 pb-32">
          <h2 className="text-2xl font-bold text-stone-100 mb-6">Your Order</h2>

          {cartItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-stone-500 text-lg">Your order is empty</p>
              <button onClick={() => setScreen('menu')} className="mt-4 text-green-500 font-semibold">
                Browse Menu →
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-8">
                {cartItems.map(item => (
                  <div key={item.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-center gap-4">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-stone-100 text-sm">{item.name}</p>
                      <p className="text-stone-500 text-xs">${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full bg-stone-800 text-stone-300 text-sm font-bold flex items-center justify-center">−</button>
                      <span className="text-stone-100 font-bold w-5 text-center text-sm">{item.qty}</span>
                      <button onClick={() => addToCart(item.id)} className="w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">+</button>
                    </div>
                    <p className="text-green-400 font-bold text-sm w-16 text-right">${(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-2 mb-6">
                <div className="flex justify-between text-sm text-stone-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-stone-400">
                  <span>{taxLabel} ({Math.round(taxRate * 100)}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-stone-700 pt-2 flex justify-between text-lg font-bold text-stone-100">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3 mb-6">
                <input
                  type="text"
                  placeholder="Your name *"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-600 focus:border-green-600 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Email (optional — for receipt)"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-600 focus:border-green-600 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4 bg-red-950 border border-red-900 rounded-lg px-4 py-2">{error}</p>
              )}

              {/* Actions */}
              <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 p-4 space-y-2 md:max-w-xl md:mx-auto">
                <button
                  onClick={handleCheckout}
                  disabled={paying}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-4 rounded-2xl font-bold text-base transition-colors"
                >
                  {paying ? 'Processing...' : `Pay $${total.toFixed(2)}`}
                </button>
                <button
                  onClick={clearCart}
                  className="w-full text-stone-500 hover:text-stone-300 py-2 text-sm font-semibold"
                >
                  Clear Order
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {screen === 'success' && (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-3xl font-bold text-stone-100 mb-2">Order Placed!</h2>
          <p className="text-stone-400 text-lg mb-8">Your order number is</p>
          <div className="bg-green-600/20 border-2 border-green-500 rounded-2xl py-6 px-8 inline-block mb-8">
            <span className="text-5xl font-bold text-green-400 tracking-wider">#{orderNumber}</span>
          </div>
          <p className="text-stone-500 mb-12">Listen for your number to be called at the food booth.</p>
          <button
            onClick={clearCart}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-8 py-3 rounded-xl font-bold transition-colors"
          >
            New Order
          </button>
        </div>
      )}
    </div>
  );
}
