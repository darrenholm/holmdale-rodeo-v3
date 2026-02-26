import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_RAILWAY_API_URL || 'https://rodeo-fresh-production-7348.up.railway.app/api';

const TAX_RATE = 0.13;

const PACKAGES = [
  { qty: 1, label: '1 Ticket', emoji: '🍺', desc: 'Single drink ticket' },
  { qty: 3, label: '3 Tickets', emoji: '🍻', desc: 'Save a trip back', popular: true },
  { qty: 5, label: '5 Tickets', emoji: '🎉', desc: 'Party starter' },
  { qty: 10, label: '10 Tickets', emoji: '🤠', desc: 'Best value — share with friends' },
];

export default function DrinkTickets() {
  const [quantity, setQuantity] = useState(0);
  const [screen, setScreen] = useState('select'); // select, checkout, success
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [ticketPrice, setTicketPrice] = useState(7.00);

  // Load ticket price from database
  useEffect(() => {
    fetch(API_URL + '/booth/menu')
      .then(r => r.json())
      .then(data => { if (data.ticketPrice) setTicketPrice(data.ticketPrice); })
      .catch(() => {}); // Fallback to $7 default
  }, []);

  const subtotal = quantity * ticketPrice;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  function selectPackage(qty) {
    setQuantity(qty);
    setScreen('checkout');
  }

  function setCustomQuantity(val) {
    const num = Math.max(0, Math.min(50, parseInt(val) || 0));
    setQuantity(num);
  }

  async function handleCheckout() {
    if (!customerName.trim()) { setError('Please enter your name'); return; }
    if (quantity < 1) { setError('Please select at least 1 ticket'); return; }
    setError('');
    setPaying(true);

    try {
      const res = await fetch(`${API_URL}/moneris/bar-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketQuantity: quantity,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          rfidTagId: 'phone-purchase', // Will be linked at the venue
        }),
      });

      const data = await res.json();

      if (data.ticket) {
        // Redirect to Moneris checkout
        window.location.href = `https://gateway.moneris.com/chktv2/index.php?ticket=${data.ticket}`;
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

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur border-b border-stone-800">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-100 tracking-wide">Drink Tickets</h1>
            <p className="text-xs text-green-500 font-semibold tracking-widest uppercase">Holmdale Pro Rodeo Bar</p>
          </div>
          {screen !== 'select' && (
            <button
              onClick={() => { setScreen('select'); setError(''); }}
              className="text-stone-400 hover:text-stone-200 font-semibold text-sm"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* SELECT SCREEN */}
      {screen === 'select' && (
        <div className="max-w-xl mx-auto px-4 py-6">
          {/* How it works */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-8">
            <h2 className="text-lg font-bold text-stone-100 mb-3">How it works</h2>
            <div className="space-y-3 text-sm text-stone-400">
              <div className="flex gap-3 items-start">
                <span className="text-green-500 font-bold text-lg mt-[-2px]">1</span>
                <p>Buy your drink tickets here on your phone</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-green-500 font-bold text-lg mt-[-2px]">2</span>
                <p>Show your confirmation at the bar or link to your wristband at the gate</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-green-500 font-bold text-lg mt-[-2px]">3</span>
                <p>Enjoy your drinks — no cash needed!</p>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <p className="text-stone-500 text-sm font-semibold uppercase tracking-wider">Price per ticket</p>
            <p className="text-4xl font-bold text-green-400 mt-1">${ticketPrice.toFixed(2)}</p>
            <p className="text-stone-600 text-xs mt-1">+ {Math.round(TAX_RATE * 100)}% HST</p>
          </div>

          {/* Quick Select Packages */}
          <div className="space-y-3 mb-8">
            {PACKAGES.map(pkg => (
              <button
                key={pkg.qty}
                onClick={() => selectPackage(pkg.qty)}
                className={`w-full bg-stone-900 border rounded-2xl p-4 flex items-center gap-4 text-left transition-colors hover:border-green-600 ${
                  pkg.popular ? 'border-green-700' : 'border-stone-800'
                }`}
              >
                <span className="text-3xl">{pkg.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100">{pkg.label}</span>
                    {pkg.popular && (
                      <span className="text-[10px] font-bold bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">Popular</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{pkg.desc}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">${(pkg.qty * ticketPrice).toFixed(2)}</p>
                  <p className="text-stone-600 text-xs">+ tax</p>
                </div>
              </button>
            ))}
          </div>

          {/* Custom Quantity */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <p className="text-sm font-bold text-stone-400 mb-3 uppercase tracking-wider">Custom amount</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCustomQuantity(quantity - 1)}
                disabled={quantity <= 0}
                className="w-10 h-10 rounded-full bg-stone-800 text-stone-300 font-bold text-xl flex items-center justify-center disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                value={quantity || ''}
                onChange={e => setCustomQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 bg-stone-800 border border-stone-700 rounded-xl text-center text-2xl font-bold text-stone-100 py-3 focus:border-green-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setCustomQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full bg-green-600 text-white font-bold text-xl flex items-center justify-center"
              >
                +
              </button>
            </div>
            {quantity > 0 && (
              <div className="mt-4 flex justify-between items-center">
                <span className="text-stone-400 text-sm">{quantity} tickets</span>
                <button
                  onClick={() => setScreen('checkout')}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
                >
                  Continue — ${total.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT SCREEN */}
      {screen === 'checkout' && (
        <div className="max-w-xl mx-auto px-4 py-6 pb-32">
          <h2 className="text-2xl font-bold text-stone-100 mb-6">Checkout</h2>

          {/* Order Summary */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-stone-300 mb-2">
              <span>🍺 Drink Tickets × {quantity}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-500 mb-2">
              <span>HST ({Math.round(TAX_RATE * 100)}%)</span>
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

          <div className="text-xs text-stone-600 mb-6">
            <p>Your drink tickets will be linked to your wristband at the gate, or you can show your confirmation email at the bar.</p>
          </div>

          {/* Pay Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 p-4 space-y-2 md:max-w-xl md:mx-auto">
            <button
              onClick={handleCheckout}
              disabled={paying}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-4 rounded-2xl font-bold text-base transition-colors"
            >
              {paying ? 'Processing...' : `Pay $${total.toFixed(2)}`}
            </button>
            <button
              onClick={() => { setScreen('select'); setQuantity(0); }}
              className="w-full text-stone-500 hover:text-stone-300 py-2 text-sm font-semibold"
            >
              Change quantity
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {screen === 'success' && (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-stone-100 mb-2">Tickets Purchased!</h2>
          <p className="text-stone-400 text-lg mb-4">
            You bought <span className="text-green-400 font-bold">{quantity} drink tickets</span>
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 mb-8 text-left space-y-3">
            <p className="text-sm text-stone-400">
              <span className="text-stone-200 font-semibold">At the gate:</span> Your tickets will be loaded onto your wristband when you check in.
            </p>
            <p className="text-sm text-stone-400">
              <span className="text-stone-200 font-semibold">At the bar:</span> Just tap your wristband to redeem. No cash or phone needed!
            </p>
            {customerEmail && (
              <p className="text-sm text-stone-400">
                <span className="text-stone-200 font-semibold">Receipt:</span> Sent to {customerEmail}
              </p>
            )}
          </div>
          <button
            onClick={() => { setScreen('select'); setQuantity(0); setCustomerName(''); setCustomerEmail(''); }}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-8 py-3 rounded-xl font-bold transition-colors"
          >
            Buy More Tickets
          </button>
        </div>
      )}
    </div>
  );
}
