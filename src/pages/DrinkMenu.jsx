import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/railwayClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scan, Wine, Beer, AlertCircle, ArrowLeft, Loader2, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const DRINK_ICONS = {
  'Coors Banquet': '🍺',
  'Coors Light': '🍺',
  'Molson Export': '🍺',
  'Twisted Tea': '🍹',
  'Rum': '🥃',
  'Rye': '🥃',
  'Vodka': '🍸',
};

export default function DrinkMenu() {
  const [step, setStep] = useState('scan'); // scan, menu, confirm, success
  const [rfidTagId, setRfidTagId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [drinks, setDrinks] = useState([]);
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isServing, setIsServing] = useState(false);
  const [error, setError] = useState('');
  const [lastServed, setLastServed] = useState(null);
  const rfidInputRef = useRef(null);

  // Load drinks on mount
  useEffect(() => {
    loadDrinks();
  }, []);

  // Keep focus on RFID input
  useEffect(() => {
    if (step === 'scan') {
      const interval = setInterval(() => rfidInputRef.current?.focus(), 300);
      return () => clearInterval(interval);
    }
  }, [step]);

  const loadDrinks = async () => {
    try {
      const result = await api.get('/drinks');
      setDrinks(result.filter(d => d.active));
    } catch (err) {
      console.error('Failed to load drinks:', err);
    }
  };

  const lookupCustomer = async (tagId) => {
    setIsScanning(true);
    setError('');
    try {
      // Look up ticket order by RFID
      const tickets = await api.get('/ticket-orders?rfid_tag_id=' + tagId);
      
      if (!tickets || tickets.length === 0) {
        setError('No ticket found for this wristband.');
        setIsScanning(false);
        return;
      }

      const ticket = tickets[0];

      if (!ticket.is_19_plus) {
        setError('This wristband is not verified 19+. Visit ID Check station first.');
        setIsScanning(false);
        return;
      }

      const available = (ticket.bar_credits || 0) - (ticket.bar_redeemed || 0);
      
      if (available <= 0) {
        setError('No bar credits remaining. Purchase more at Bar Sales.');
        setIsScanning(false);
        return;
      }

      setCustomer({
        id: ticket.id,
        name: ticket.customer_name,
        credits: ticket.bar_credits || 0,
        redeemed: ticket.bar_redeemed || 0,
        available: available
      });

      setStep('menu');
      setIsScanning(false);
    } catch (err) {
      setError('Failed to look up wristband: ' + err.message);
      setIsScanning(false);
    }
  };

  const handleRfidKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tagId = rfidTagId.trim();
      if (!tagId) return;
      await lookupCustomer(tagId);
    }
  };

  const scanNFC = async () => {
    setIsScanning(true);
    setError('');
    try {
      if ('NDEFReader' in window) {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.addEventListener('reading', async ({ serialNumber }) => {
          setRfidTagId(serialNumber);
          await lookupCustomer(serialNumber);
        });
      } else {
        setIsScanning(false);
      }
    } catch (err) {
      setError('NFC not available. Use USB scanner.');
      setIsScanning(false);
    }
  };

  const handleServeDrink = async () => {
    if (!selectedDrink || !customer) return;

    setIsServing(true);
    setError('');
    try {
      // 1. Deduct from customer's bar credits
      const newRedeemed = customer.redeemed + 1;
      await api.put('/bar-credits/' + customer.id, {
        drinks_redeemed: newRedeemed
      });

      // 2. Deduct from drink inventory
      try {
        await api.post('/drinks/serve', {
          rfid_uid: rfidTagId,
          drink_id: selectedDrink.id
        });
      } catch (invErr) {
        // Inventory update failed but credit was deducted — log it
        console.error('Inventory deduction failed:', invErr);
      }

      setLastServed({
        drink: selectedDrink,
        customer: customer.name,
        remaining: customer.available - 1
      });

      // Update local customer state
      setCustomer(prev => ({
        ...prev,
        redeemed: newRedeemed,
        available: prev.available - 1
      }));

      // Refresh drink list for stock counts
      loadDrinks();

      setStep('success');
      setIsServing(false);
    } catch (err) {
      setError('Failed to serve drink: ' + err.message);
      setIsServing(false);
    }
  };

  const serveAnother = () => {
    setSelectedDrink(null);
    if (customer.available - 1 > 0) {
      // Customer still has credits — go back to menu
      setStep('menu');
    } else {
      // No more credits — reset
      resetFlow();
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setRfidTagId('');
    setCustomer(null);
    setSelectedDrink(null);
    setError('');
    setLastServed(null);
  };

  // ========== SUCCESS SCREEN ==========
  if (step === 'success' && lastServed) {
    return (
      <div className="min-h-screen bg-stone-950 pt-24 pb-20 px-6 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg w-full">
          <Card className="bg-stone-900 border-stone-800 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Drink Served!</h2>
            <p className="text-4xl mb-4">{DRINK_ICONS[lastServed.drink.name] || '🍺'}</p>
            <p className="text-xl text-white mb-1">{lastServed.drink.name}</p>
            <p className="text-stone-400 mb-6">for {lastServed.customer}</p>

            <div className="bg-stone-800/50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Credits Remaining</span>
                <span className="text-green-400 font-bold text-xl">{lastServed.remaining}</span>
              </div>
            </div>

            <div className="flex gap-3">
              {lastServed.remaining > 0 && (
                <Button onClick={serveAnother} className="flex-1 bg-green-500 hover:bg-green-600 text-stone-900">
                  Serve Another
                </Button>
              )}
              <Button onClick={resetFlow} variant="outline" className="flex-1 border-stone-700 text-white hover:bg-stone-800">
                New Customer
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <Link to={createPageUrl('Staff')} className="inline-flex items-center gap-2 text-stone-400 hover:text-green-400 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Staff Dashboard
        </Link>

        {error && (
          <div className="bg-red-950/50 border border-red-700 rounded-lg p-4 text-red-300 flex gap-2 mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button onClick={() => setError('')} className="mt-2 underline text-sm">Dismiss</button>
            </div>
          </div>
        )}

        {/* ========== SCAN STEP ========== */}
        {step === 'scan' && (
          <Card className="bg-stone-900 border-stone-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Beer className="w-6 h-6 text-green-500" />
                Bar Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <Scan className="w-12 h-12 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Scan Wristband</h3>
                <p className="text-stone-400 mb-8">Scan to view credits and serve a drink</p>

                <div className="max-w-sm mx-auto mb-6">
                  <Input
                    ref={rfidInputRef}
                    type="text"
                    value={rfidTagId}
                    onChange={(e) => setRfidTagId(e.target.value)}
                    onKeyDown={handleRfidKeyDown}
                    placeholder="RFID tag ID (auto-filled by scanner)"
                    className="bg-stone-800 border-stone-700 text-white text-center text-lg"
                    autoFocus
                  />
                  <p className="text-stone-500 text-xs mt-2">Scanner will auto-submit on Enter</p>
                </div>

                <Button onClick={scanNFC} disabled={isScanning} className="bg-green-500 hover:bg-green-600 text-stone-900 px-8 py-6 text-lg">
                  {isScanning ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Scanning...</>
                  ) : (
                    <><Scan className="w-5 h-5 mr-2" /> Start NFC Scan</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== DRINK MENU ========== */}
        {step === 'menu' && customer && (
          <div className="space-y-6">
            {/* Customer info bar */}
            <Card className="bg-stone-900 border-stone-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-stone-400 text-sm">Customer</p>
                    <p className="text-white font-semibold text-lg">{customer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-stone-400 text-sm">Available Credits</p>
                    <p className="text-green-400 font-bold text-3xl">{customer.available}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Drink grid */}
            <Card className="bg-stone-900 border-stone-800">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Select Drink</CardTitle>
                  <Button onClick={loadDrinks} variant="ghost" size="sm" className="text-stone-400 hover:text-white">
                    <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {drinks.map((drink) => (
                    <button
                      key={drink.id}
                      onClick={() => { setSelectedDrink(drink); setStep('confirm'); }}
                      disabled={drink.stock_remaining < 1}
                      className={`p-6 rounded-xl border-2 transition-all text-center ${
                        drink.stock_remaining < 1
                          ? 'border-stone-800 bg-stone-900/50 opacity-50 cursor-not-allowed'
                          : 'border-stone-700 bg-stone-800/50 hover:border-green-500 hover:bg-green-500/10 cursor-pointer'
                      }`}
                    >
                      <span className="text-4xl block mb-3">{DRINK_ICONS[drink.name] || '🍺'}</span>
                      <p className="text-white font-bold text-lg">{drink.name}</p>
                      <p className="text-green-400 font-semibold mt-1">${parseFloat(drink.price).toFixed(2)}</p>
                      <div className="mt-2">
                        {drink.stock_remaining < 1 ? (
                          <Badge variant="destructive" className="text-xs">OUT OF STOCK</Badge>
                        ) : drink.stock_remaining < 10 ? (
                          <Badge className="bg-yellow-600 text-xs">{drink.stock_remaining} left</Badge>
                        ) : (
                          <Badge variant="outline" className="border-stone-600 text-stone-400 text-xs">
                            <Package className="w-3 h-3 mr-1" />{drink.stock_remaining}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <Button onClick={resetFlow} variant="outline" className="w-full border-stone-700 text-white hover:bg-stone-800">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== CONFIRM STEP ========== */}
        {step === 'confirm' && customer && selectedDrink && (
          <Card className="bg-stone-900 border-stone-800">
            <CardHeader>
              <CardTitle className="text-white text-center">Confirm Drink</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-6">
                <span className="text-6xl block mb-4">{DRINK_ICONS[selectedDrink.name] || '🍺'}</span>
                <h3 className="text-2xl font-bold text-white">{selectedDrink.name}</h3>
                <p className="text-green-400 text-xl mt-1">1 credit</p>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Customer</span>
                  <span className="text-white">{customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Current Credits</span>
                  <span className="text-white">{customer.available}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">After Serving</span>
                  <span className="text-green-400 font-bold">{customer.available - 1}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep('menu')} variant="outline" className="flex-1 border-stone-700 text-white hover:bg-stone-800">
                  Back
                </Button>
                <Button
                  onClick={handleServeDrink}
                  disabled={isServing}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-stone-900 font-semibold py-6 text-lg"
                >
                  {isServing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Serving...</>
                  ) : (
                    <>Serve Drink</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
