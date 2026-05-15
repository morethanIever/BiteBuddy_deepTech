import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const KIT_KEY  = 'bb_kit_count';
const DEV_KEY  = 'bb_device_key';
const REST_KEY = 'bb_portal_restaurant_id';

const INGREDIENTS = [
  { id: 'seafood',    label: 'Seafood',       icon: '🐟', risk: 'high',   examples: 'Fish, Prawns, Squid, Clams' },
  { id: 'meat',       label: 'Meat',          icon: '🥩', risk: 'high',   examples: 'Beef, Pork, Lamb' },
  { id: 'poultry',    label: 'Poultry',       icon: '🍗', risk: 'high',   examples: 'Chicken, Duck, Turkey' },
  { id: 'rice',       label: 'Rice & Grains', icon: '🍚', risk: 'medium', examples: 'Rice, Noodles, Flour' },
  { id: 'dairy',      label: 'Dairy',         icon: '🥛', risk: 'medium', examples: 'Milk, Cheese, Eggs' },
  { id: 'vegetables', label: 'Vegetables',    icon: '🥦', risk: 'low',    examples: 'Greens, Roots, Herbs' },
];

const SCAN_PHASES = [
  { pct: 8,   msg: 'Sample loaded (9 µL)…' },
  { pct: 22,  msg: 'Conditioning biosensor electrodes…' },
  { pct: 40,  msg: 'Aptamer–pathogen binding in progress…' },
  { pct: 58,  msg: 'Acquiring DPV signal…' },
  { pct: 74,  msg: 'Converting signal → CFU/mL…' },
  { pct: 88,  msg: 'Applying detection thresholds…' },
  { pct: 96,  msg: 'Computing safety score…' },
  { pct: 100, msg: 'Analysis complete' },
];

const BACTERIA = [
  { key: 'ecoli',   label: 'E. coli',   sub: 'O157:H7' },
  { key: 'staph',   label: 'S. aureus', sub: 'MRSA risk' },
  { key: 'bcereus', label: 'B. cereus', sub: 'Emetic' },
];

const STATUS_COLOR = { ND: '#1D9E75', Trace: '#D4941A', Detected: '#E24B4A' };
const RISK_LABEL   = { high: '⚠ High risk', medium: '◦ Medium risk', low: '✓ Low risk' };
const RISK_COLOR   = { high: '#E24B4A', medium: '#D4941A', low: '#1D9E75' };

// ── Setup Modal ───────────────────────────────────────────────────────────────
function SetupModal({ restaurants, deviceKey, setDeviceKey, restaurantId, setRestaurantId, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-head text-xl font-bold text-navy">Device Setup</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Device Key</label>
            <input className="input w-full font-mono text-sm" placeholder="BB-DEV-001-ALPHA"
              value={deviceKey} onChange={e => setDeviceKey(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Provided by your BiteBuddy coordinator</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Your Restaurant</label>
            <select className="input w-full" value={restaurantId} onChange={e => setRestaurantId(e.target.value)}>
              <option value="">Select restaurant…</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name} ({r.area})</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={onSave} className="btn-primary text-sm px-5 py-2">Save Setup</button>
        </div>
      </div>
    </div>
  );
}

// ── Kit Counter Widget ────────────────────────────────────────────────────────
function KitCounter({ count, onRestock }) {
  const low = count <= 2;
  return (
    <div className={`flex items-center justify-between rounded-2xl p-4 mb-5 border ${low ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`font-head text-3xl font-extrabold ${low ? 'text-amber-600' : 'text-green'}`}>{count}</div>
        <div>
          <div className="font-semibold text-navy text-sm">Test Kits Remaining</div>
          <div className="text-xs text-gray-400">{low ? 'Low stock — reorder soon' : 'Stock level OK'}</div>
        </div>
      </div>
      {low && (
        <button onClick={onRestock}
          className="text-xs font-bold bg-amber-500 text-white px-3 py-2 rounded-lg border-0 cursor-pointer hover:bg-amber-600 transition">
          Restock →
        </button>
      )}
    </div>
  );
}

// ── Step: Morning Check ───────────────────────────────────────────────────────
function StepCheck({ kitCount, onHaveKits, onNoKits }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div className="text-6xl mb-4">🌅</div>
      <h2 className="font-head text-2xl font-bold text-navy mb-2">Good Morning!</h2>
      <p className="text-gray-500 mb-8 max-w-xs mx-auto">
        Let's complete your daily food safety check before service begins.
      </p>
      <p className="font-semibold text-navy mb-5">Do you have testing kits available?</p>
      <div className="flex gap-4 justify-center">
        <button onClick={kitCount > 0 ? onHaveKits : onNoKits}
          className="flex-1 max-w-[200px] py-5 rounded-2xl border-2 border-green bg-green-50 text-green-dark font-bold text-base cursor-pointer hover:bg-green hover:text-white transition">
          ✅ Yes, kits ready
        </button>
        <button onClick={onNoKits}
          className="flex-1 max-w-[200px] py-5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-base cursor-pointer hover:bg-gray-100 transition">
          ❌ Need to restock
        </button>
      </div>
    </div>
  );
}

// ── Step: Restock ─────────────────────────────────────────────────────────────
function StepRestock({ onAddDemoKits, onBack }) {
  const plans = [
    { name: 'Starter Pack',  qty: 10, price: 'RM 120', per: 'RM 12/kit',  tag: null },
    { name: 'Monthly Pack',  qty: 30, price: 'RM 300', per: 'RM 10/kit',  tag: 'Popular' },
    { name: 'Pro Plan',      qty: 90, price: 'RM 720', per: 'RM 8/kit',   tag: 'Best value' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-4xl">📦</div>
          <div>
            <h2 className="font-head text-xl font-bold text-navy">Restock Your Kits</h2>
            <p className="text-sm text-gray-500">Subscribe and never run out</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          {plans.map(plan => (
            <div key={plan.name}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-green hover:bg-green-50 cursor-pointer transition">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy">{plan.name}</span>
                  {plan.tag && (
                    <span className="text-xs bg-green text-white px-2 py-0.5 rounded-full font-semibold">{plan.tag}</span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-0.5">{plan.qty} kits · {plan.per}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-navy">{plan.price}</div>
                <div className="text-xs text-green font-semibold mt-1">Order →</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 text-center mb-3">Demo mode — add kits instantly to continue</p>
          <button onClick={onAddDemoKits}
            className="w-full py-3 rounded-xl bg-navy text-white font-bold cursor-pointer border-0 hover:opacity-90 transition">
            📦 Add 10 Demo Kits & Continue
          </button>
        </div>
      </div>

      <button onClick={onBack} className="text-sm text-gray-400 text-center bg-transparent border-0 cursor-pointer hover:text-navy">
        ← Back to morning check
      </button>
    </div>
  );
}

// ── Step: Ingredient Selection ────────────────────────────────────────────────
function StepIngredient({ selected, onSelect, onRun, error }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-head text-xl font-bold text-navy mb-1">Select Ingredient to Test</h2>
        <p className="text-sm text-gray-500 mb-5">Choose the high-risk item you're preparing this morning.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-danger rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {INGREDIENTS.map(ing => (
            <button key={ing.id} onClick={() => onSelect(ing)}
              className={`p-4 rounded-xl border-2 text-left cursor-pointer transition bg-transparent ${
                selected?.id === ing.id
                  ? 'border-green bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <div className="text-3xl mb-2">{ing.icon}</div>
              <div className="font-semibold text-navy text-sm leading-tight">{ing.label}</div>
              <div className="text-xs text-gray-400 mt-1">{ing.examples}</div>
              <div className="text-xs font-semibold mt-2" style={{ color: RISK_COLOR[ing.risk] }}>
                {RISK_LABEL[ing.risk]}
              </div>
            </button>
          ))}
        </div>

        <button onClick={onRun} disabled={!selected}
          className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-0 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: selected ? '#0C1B2E' : '#9ca3af', color: 'white' }}>
          {selected
            ? `▶ Run Biosensor Test — ${selected.icon} ${selected.label}`
            : 'Select an ingredient above to continue'}
        </button>
      </div>
    </div>
  );
}

// ── Step: Scanning ────────────────────────────────────────────────────────────
function StepScanning({ ingredient, phaseIndex }) {
  const phase = SCAN_PHASES[phaseIndex] || SCAN_PHASES[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div className="text-6xl mb-4" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
        {ingredient?.icon}
      </div>
      <h2 className="font-head text-xl font-bold text-navy mb-1">Running Biosensor Test</h2>
      <p className="text-sm text-gray-500 mb-6">Testing {ingredient?.label} sample — please wait…</p>

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${phase.pct}%`, background: '#1D9E75' }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>{phase.pct}%</span>
        <span className="text-green font-semibold">{phase.msg}</span>
      </div>

      {/* Bacteria sensor indicators */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {BACTERIA.map((b, i) => {
          const active = phaseIndex >= i + 2;
          return (
            <div key={b.key} className="rounded-xl p-3 bg-gray-50 border border-gray-100">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 transition-all duration-500 ${active ? 'bg-green' : 'bg-gray-300'}`}
                style={active ? { boxShadow: '0 0 6px #1D9E75', animation: 'pulse 1.2s ease-in-out infinite' } : {}} />
              <div className="text-xs font-semibold text-gray-600" style={{ fontStyle: 'italic' }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{active ? 'Analysing…' : 'Pending'}</div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-300 mt-6">Do not disturb the device during analysis</p>
    </div>
  );
}

// ── Step: Result ──────────────────────────────────────────────────────────────
function StepResult({ result, ingredient, restaurant, onTestAnother, onDone }) {
  const isPositive = result.result !== 'safe';
  const detected   = BACTERIA.filter(b => result[b.key] && result[b.key] !== 'ND');

  return (
    <div className="flex flex-col gap-4">
      {/* Main verdict */}
      <div className={`rounded-2xl border-2 p-6 ${isPositive ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
        <div className="text-center mb-5">
          <div className="text-6xl mb-3">{isPositive ? '🚨' : '✅'}</div>
          <h2 className={`font-head text-3xl font-extrabold mb-1 ${isPositive ? 'text-danger' : 'text-green'}`}>
            {isPositive ? 'CONTAMINATION DETECTED' : 'ALL CLEAR'}
          </h2>
          <p className="text-gray-600 text-sm">
            {isPositive
              ? `Pathogen${detected.length > 1 ? 's' : ''} found in your ${ingredient?.label || 'sample'}`
              : `${ingredient?.label || 'Sample'} is safe to serve`}
          </p>
        </div>

        {/* Bacteria readings */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {BACTERIA.map(b => {
            const level = result[b.key] || 'ND';
            const color = STATUS_COLOR[level] || '#1D9E75';
            return (
              <div key={b.key} className="rounded-xl p-3 text-center bg-white border"
                style={{ borderColor: color + '40' }}>
                <div className="text-xs text-gray-500 font-semibold leading-tight mb-1" style={{ fontStyle: 'italic' }}>
                  {b.label}
                </div>
                <div className="text-xs text-gray-400 mb-2">{b.sub}</div>
                <div className="font-bold text-sm" style={{ color }}>{level}</div>
              </div>
            );
          })}
        </div>

        {/* Action box */}
        <div className={`rounded-xl p-4 ${isPositive ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'}`}>
          {isPositive ? (
            <div>
              <div className="font-bold text-danger mb-2 flex items-center gap-2">
                <span>⚠</span> Required Action
              </div>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Discard all {ingredient?.label} immediately.</strong> Do not use or serve this batch.
                Bag and seal contaminated items and mark for disposal.
              </p>
              {detected.length > 0 && (
                <p className="text-xs text-gray-500">
                  Detected: {detected.map(b => b.label).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="font-bold text-green mb-1">✓ Safe to proceed</div>
              <p className="text-sm text-gray-700">
                No pathogens detected. Your {ingredient?.label} meets food safety standards. Proceed with service.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Data upload status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green font-bold">✓</div>
          <div>
            <div className="font-semibold text-navy text-sm">Data Uploaded Automatically</div>
            <div className="text-xs text-gray-400">
              {restaurant?.name} · SafeMap updated · {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        <Link to="/map" className="text-xs text-green font-semibold no-underline hover:underline whitespace-nowrap">
          View Map →
        </Link>
      </div>

      {/* Incident report if positive */}
      {isPositive && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
          <div className="text-xl mt-0.5">📋</div>
          <div>
            <div className="font-semibold text-amber-800 text-sm">Incident Report Filed</div>
            <div className="text-xs text-amber-700 mt-1">
              Your BiteBuddy coordinator has been notified. Restaurant status is temporarily set to{' '}
              <em>Under Review</em> on the public map until a follow-up scan confirms clearance.
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onTestAnother}
          className="py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold cursor-pointer bg-transparent hover:bg-gray-100 transition">
          Test Another
        </button>
        <button onClick={onDone}
          className="py-3 rounded-xl font-bold cursor-pointer border-0 hover:opacity-90 transition"
          style={{ background: '#0C1B2E', color: 'white' }}>
          Done for Today ✓
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RestaurantPortal() {
  const [step,         setStep]        = useState('check');
  const [kitCount,     setKitCount]    = useState(() => parseInt(localStorage.getItem(KIT_KEY) ?? '10'));
  const [deviceKey,    setDeviceKey]   = useState(() => localStorage.getItem(DEV_KEY) || '');
  const [restaurantId, setRestaurantId]= useState(() => localStorage.getItem(REST_KEY) || '');
  const [restaurants,  setRestaurants] = useState([]);
  const [ingredient,   setIngredient]  = useState(null);
  const [phaseIndex,   setPhaseIndex]  = useState(0);
  const [result,       setResult]      = useState(null);
  const [error,        setError]       = useState('');
  const [showSetup,    setShowSetup]   = useState(false);

  useEffect(() => {
    axios.get('/api/restaurants').then(r => setRestaurants(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { localStorage.setItem(KIT_KEY, kitCount); }, [kitCount]);

  function saveSetup() {
    localStorage.setItem(DEV_KEY, deviceKey);
    localStorage.setItem(REST_KEY, restaurantId);
    setShowSetup(false);
  }

  async function runScan() {
    if (!deviceKey)    { setError('Enter your device key in ⚙ Setup first.'); setShowSetup(true); return; }
    if (!restaurantId) { setError('Select your restaurant in ⚙ Setup first.'); setShowSetup(true); return; }

    setStep('scanning');
    setPhaseIndex(0);
    setResult(null);
    setError('');

    // Start API call in parallel with animation
    const scanPromise = axios.post('/api/scans/device-test', {
      restaurant_id: parseInt(restaurantId),
      ingredient: ingredient?.id,
    }, { headers: { 'X-Device-Key': deviceKey } });

    // Animate phases (skip the last one — shown after API returns)
    for (let i = 1; i < SCAN_PHASES.length - 1; i++) {
      await new Promise(r => setTimeout(r, 1300));
      setPhaseIndex(i);
    }

    try {
      const res = await scanPromise;
      setPhaseIndex(SCAN_PHASES.length - 1);
      await new Promise(r => setTimeout(r, 600));
      setKitCount(c => Math.max(0, c - 1));
      setResult(res.data);
      setStep('result');
    } catch (err) {
      setError(err.response?.data?.error || 'Test failed — check your device key and try again.');
      setStep('ingredient');
    }
  }

  const currentRestaurant = restaurants.find(r => String(r.id) === String(restaurantId));

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {showSetup && (
        <SetupModal
          restaurants={restaurants}
          deviceKey={deviceKey}       setDeviceKey={setDeviceKey}
          restaurantId={restaurantId} setRestaurantId={setRestaurantId}
          onSave={saveSetup}
          onClose={() => setShowSetup(false)}
        />
      )}

      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-head text-2xl font-extrabold text-navy">Restaurant Safety Portal</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {currentRestaurant
                ? `${currentRestaurant.name} · ${currentRestaurant.area}`
                : 'Configure your device to begin'}
            </p>
          </div>
          <button onClick={() => setShowSetup(true)}
            className="text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-navy transition cursor-pointer border-solid flex-shrink-0 mt-1">
            ⚙ Setup
          </button>
        </div>

        {/* Kit counter (always visible except during scan) */}
        {step !== 'scanning' && (
          <KitCounter count={kitCount} onRestock={() => setStep('restock')} />
        )}

        {step === 'check' && (
          <StepCheck
            kitCount={kitCount}
            onHaveKits={() => setStep('ingredient')}
            onNoKits={() => setStep('restock')}
          />
        )}

        {step === 'restock' && (
          <StepRestock
            onAddDemoKits={() => { setKitCount(10); setStep('ingredient'); }}
            onBack={() => setStep('check')}
          />
        )}

        {step === 'ingredient' && (
          <StepIngredient
            selected={ingredient}
            onSelect={setIngredient}
            onRun={runScan}
            error={error}
          />
        )}

        {step === 'scanning' && (
          <StepScanning ingredient={ingredient} phaseIndex={phaseIndex} />
        )}

        {step === 'result' && result && (
          <StepResult
            result={result}
            ingredient={ingredient}
            restaurant={currentRestaurant}
            onTestAnother={() => { setStep('ingredient'); setIngredient(null); setResult(null); setError(''); }}
            onDone={() => { setStep('check'); setIngredient(null); setResult(null); setError(''); }}
          />
        )}
      </div>
    </div>
  );
}
