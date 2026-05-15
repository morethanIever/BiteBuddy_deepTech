import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../lib/api';
import { useToast } from '../lib/toast';

// ── Constants ────────────────────────────────────────────────────────────────
const BACTERIA = [
  { key: 'ecoli',   label: 'E. coli O157:H7',    aptamer: 'S1-2',   kd: '8.79 nM',  risk: 'Severe diarrhea, HUS' },
  { key: 'staph',   label: 'S. aureus',           aptamer: 'SA43-3', kd: '14.2 nM',  risk: 'Food poisoning, vomiting' },
  { key: 'bcereus', label: 'B. cereus',           aptamer: 'BC-1',   kd: '28.34 nM', risk: 'Nausea, emetic toxins' },
];

const PRESETS = {
  safe:    { label: 'All clear',          desc: 'No pathogens detected — restaurant passes', color: '#1D9E75', bg: '#E1F5EE' },
  warning: { label: 'Trace contamination',desc: 'B. cereus trace found — borderline result',  color: '#D4941A', bg: '#FFF3CD' },
  danger:  { label: 'Contamination found',desc: 'E. coli & B. cereus detected — FAIL',        color: '#E24B4A', bg: '#FCEBEB' },
};

const SCAN_PHASES = [
  { id: 'idle',        label: 'Ready',                    pct: 0   },
  { id: 'loading',     label: 'Loading sample (9 µL)…',  pct: 5   },
  { id: 'prep',        label: 'Conditioning electrodes…', pct: 12  },
  { id: 'binding',     label: 'Aptamer binding…',         pct: 30  },
  { id: 'signal',      label: 'Acquiring DPV signal…',    pct: 55  },
  { id: 'raw',         label: 'Raw signal captured',      pct: 65  },
  { id: 'cfu',         label: 'Calculating CFU/mL…',      pct: 75  },
  { id: 'classify',    label: 'Applying thresholds…',     pct: 88  },
  { id: 'scoring',     label: 'Computing safety score…',  pct: 96  },
  { id: 'complete',    label: 'Analysis complete',         pct: 100 },
];

const STATUS_COLORS = { safe: '#1D9E75', warning: '#D4941A', danger: '#E24B4A', ND: '#1D9E75', Trace: '#D4941A', Detected: '#E24B4A' };

// ── ElectrodeChart — animated sine wave mimicking DPV output ─────────────────
function ElectrodeChart({ scanning, rawNa, bacteria }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const frame     = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // Grid
      ctx.strokeStyle = 'rgba(128,128,128,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * i / 5, 0); ctx.lineTo(W * i / 5, H); ctx.stroke();
      }

      // Axis labels
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.font      = '10px sans-serif';
      ctx.fillText('+0.5V', 4, 12);
      ctx.fillText('−0.5V', 4, H - 4);
      ctx.fillText('Potential →', W - 70, H - 4);

      // Draw 3 DPV curves, one per electrode
      BACTERIA.forEach((b, bi) => {
        const nA   = rawNa?.[b.key] ?? 1.2;
        const amp  = Math.min(0.85, (nA / 25) * 0.85);
        const peakX = 0.25 + bi * 0.25;
        const color = ['#1D9E75', '#378ADD', '#EF9F27'][bi];

        ctx.beginPath();
        ctx.strokeStyle = scanning ? color : 'rgba(128,128,128,0.3)';
        ctx.lineWidth   = 1.5;

        const noise = scanning ? frame.current * 0.03 : 0;

        for (let px = 0; px < W; px++) {
          const x  = px / W;
          const dx = x - peakX;
          // Gaussian peak + noise
          const y  = amp * Math.exp(-(dx * dx) / 0.004) + (Math.random() - 0.5) * 0.02 * (scanning ? 1 : 0);
          const sy = H - (y + 0.05) * H * 0.85 - 10;
          px === 0 ? ctx.moveTo(px, sy) : ctx.lineTo(px, sy);
        }
        ctx.stroke();

        // Peak label
        if (rawNa) {
          const peakPx = peakX * W;
          const peakY  = H - (amp + 0.05) * H * 0.85 - 14;
          ctx.fillStyle = color;
          ctx.font      = 'bold 9px sans-serif';
          ctx.fillText(`${nA.toFixed(1)} nA`, peakPx - 14, peakY - 2);
        }
      });

      if (scanning) {
        frame.current++;
        animRef.current = requestAnimationFrame(draw);
      }
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [scanning, rawNa]);

  return (
    <canvas
      ref={canvasRef}
      width={400} height={140}
      style={{ width: '100%', height: 140, borderRadius: 8, background: 'var(--color-background-secondary)' }}
    />
  );
}

// ── CFU Bar ───────────────────────────────────────────────────────────────────
function CFUBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, color: 'var(--color-text-secondary)' }}>
        <span style={{ fontStyle: 'italic' }}>{label}</span>
        <span style={{ fontWeight: 500, color: value > 0 ? color : 'var(--color-text-tertiary)' }}>
          {value > 0 ? `${value.toLocaleString()} CFU/mL` : '< 10 CFU/mL'}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  );
}

// ── Main Simulator ────────────────────────────────────────────────────────────
export default function DeviceSimulator() {
  const toast = useToast();

  const [restaurants, setRestaurants]   = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [preset, setPreset]             = useState('safe');

  const [phase,   setPhase]   = useState(SCAN_PHASES[0]);
  const [scanning, setScanning] = useState(false);
  const [result,  setResult]  = useState(null);   // final scan result
  const [rawNa,   setRawNa]   = useState(null);
  const [cfuData, setCfuData] = useState(null);
  const [levels,  setLevels]  = useState(null);

  const [scanCount, setScanCount]   = useState(0);
  const [history,   setHistory]     = useState([]);
  const [showCert,  setShowCert]    = useState(false);

  const esRef = useRef(null);

  // Load restaurants
  useEffect(() => {
    api.get('/api/restaurants').then(r => {
      setRestaurants(r.data.data);
      if (r.data.data.length) setRestaurantId(String(r.data.data[0].id));
    }).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setPhase(SCAN_PHASES[0]); setScanning(false);
    setResult(null); setRawNa(null); setCfuData(null); setLevels(null); setShowCert(false);
  }, []);

  const runScan = useCallback(() => {
    if (!restaurantId) { toast('Select a restaurant first', 'warning'); return; }
    if (scanning) return;

    reset();
    setScanning(true);
    setPhase(SCAN_PHASES[1]);

    const token = localStorage.getItem('bb_token');
    const url   = `/api/scans/stream/${restaurantId}?preset=${preset}&token=${encodeURIComponent(token || '')}`;
    const es    = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    let sseResultReceived = false;
    let fallbackCalled    = false;

    es.addEventListener('phase', e => {
      const d = JSON.parse(e.data);
      setPhase(p => ({ ...p, ...d, label: d.msg }));
    });
    es.addEventListener('raw', e => {
      const d = JSON.parse(e.data);
      setRawNa(d.raw_nA);
    });
    es.addEventListener('cfu', e => {
      const d = JSON.parse(e.data);
      setCfuData(d.cfu_per_ml);
    });
    es.addEventListener('levels', e => {
      const d = JSON.parse(e.data);
      setLevels({ ecoli: d.ecoli, staph: d.staph, bcereus: d.bcereus });
    });
    es.addEventListener('result', e => {
      sseResultReceived = true;
      const d = JSON.parse(e.data);
      setPhase({ ...SCAN_PHASES[9], label: 'Analysis complete' });
      setResult(d);
      setScanning(false);
      setScanCount(n => n + 1);
      setHistory(h => [{ ...d, preset, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 10));
      toast(`Scan complete: ${d.result.toUpperCase()} — ${d.restaurant_name}`, d.result === 'safe' ? 'success' : 'error');
      es.close();
    });

    es.onerror = () => {
      es.close();
      if (!sseResultReceived && !fallbackCalled) {
        fallbackCalled = true;
        fallbackSimulate(token);
      }
    };
  }, [restaurantId, preset, scanning, reset, toast]);

  // Fallback: step through phases manually, call /api/scans/simulate at the end
  const fallbackSimulate = useCallback(async (token) => {
    const steps = SCAN_PHASES.slice(1);
    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise(r => setTimeout(r, 1400));
      setPhase(steps[i]);
    }
    try {
      const { data } = await api.post('/api/scans/simulate', { restaurant_id: parseInt(restaurantId), preset });
      const scan = data.data;
      const pipe = data.pipeline;

      setRawNa(pipe?.raw_nA || null);
      setCfuData(pipe?.cfu_per_ml || null);
      setLevels({ ecoli: scan.ecoli, staph: scan.staph, bcereus: scan.bcereus });

      await new Promise(r => setTimeout(r, 800));
      setPhase({ ...SCAN_PHASES[9], label: 'Analysis complete' });
      setResult({ ...scan, pipeline: pipe });
      setScanning(false);
      setScanCount(n => n + 1);
      setHistory(h => [{ ...scan, preset, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 10));
      toast(`Scan complete: ${scan.result.toUpperCase()} — ${scan.restaurant_name}`, scan.result === 'safe' ? 'success' : 'error');
    } catch (err) {
      toast('Simulation failed — are you logged in?', 'error');
      setScanning(false);
      setPhase(SCAN_PHASES[0]);
    }
  }, [restaurantId, preset, toast]);

  const currentRestaurant = restaurants.find(r => String(r.id) === restaurantId);
  const maxCFU = cfuData ? Math.max(...Object.values(cfuData), 1000) : 10000;

  return (
    <div className="pt-16 min-h-screen" style={{ background: '#0C1B2E' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: scanning ? '#1D9E75' : '#888', animation: scanning ? 'pulse-dot 1s infinite' : 'none' }} />
              <span style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.6rem', fontWeight: 800, color: 'white' }}>
                BiteBuddy <span style={{ color: '#1D9E75' }}>Device</span> Simulator
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              Multiplex biosensor · Graphene oxide/PEDOT:PSS · GO aptamers · 9 µL sample · LOD 10 CFU/mL
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)', color: '#1D9E75', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
              {scanCount} scan{scanCount !== 1 ? 's' : ''} today
            </span>
            <Link to="/dashboard" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
              → Dashboard
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem' }}>

          {/* ── LEFT PANEL: Device control ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Physical device mockup */}
            <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: 'white', fontSize: 15 }}>BiteBuddy™ Pro</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>v2.1.0 · UMIP PI-2024</span>
              </div>

              {/* Device body */}
              <div style={{ background: '#E8E4DC', borderRadius: 12, padding: '1rem', marginBottom: '1rem', position: 'relative' }}>
                {/* LED indicator */}
                <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%',
                  background: scanning ? '#1D9E75' : result ? (STATUS_COLORS[result.result] || '#888') : '#555',
                  boxShadow: scanning ? '0 0 6px #1D9E75' : 'none',
                  transition: 'all 0.3s'
                }} />
                <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 11, fontWeight: 700, color: '#0C1B2E', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Multiplex Biosensor
                </div>

                {/* Electrode slots */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {BACTERIA.map((b, i) => (
                    <div key={b.key} style={{ flex: 1, background: '#C8C4BC', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: scanning ? ['#1D9E75','#378ADD','#EF9F27'][i] : '#999',
                        margin: '0 auto 4px', transition: 'background 0.5s', boxShadow: scanning ? `0 0 6px ${ ['#1D9E75','#378ADD','#EF9F27'][i]}` : 'none'
                      }} />
                      <div style={{ fontSize: 8, color: '#333', fontWeight: 600, lineHeight: 1.3 }}>
                        {b.aptamer}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sample slot */}
                <div style={{ background: '#B0AAA0', borderRadius: 8, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: '#555', fontWeight: 500 }}>
                    {scanning ? '⟶ Sample loaded (9 µL)' : 'INSERT TEST STRIP'}
                  </span>
                </div>

                {/* Display */}
                <div style={{ background: '#1a2d45', borderRadius: 8, marginTop: 8, padding: '8px 10px', minHeight: 48 }}>
                  {result ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Result</div>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, color: STATUS_COLORS[result.result] }}>
                        {result.result?.toUpperCase()} {result.result === 'safe' ? '✓' : '✗'}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Score: {result.score}/100</div>
                    </div>
                  ) : scanning ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#1D9E75', fontWeight: 600, marginBottom: 4 }}>{phase.label}</div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${phase.pct || 0}%`, background: '#1D9E75', transition: 'width 0.6s ease', borderRadius: 4 }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Standby</div>
                  )}
                </div>
              </div>

              {/* Spec badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[['LOD','10 CFU/mL'],['Range','10–10⁸'],['Sample','9 µL'],['Time','~15 min'],['Electrodes','GO/PEDOT:PSS']].map(([k,v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}: </span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Scan Configuration
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>Restaurant</label>
                <select
                  value={restaurantId}
                  onChange={e => setRestaurantId(e.target.value)}
                  disabled={scanning}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px', color: 'white', fontSize: 13, outline: 'none' }}
                >
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id} style={{ background: '#1a2d45' }}>
                      {r.name} ({r.area})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Sample Preset</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(PRESETS).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => !scanning && setPreset(key)}
                      disabled={scanning}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: preset === key ? `${info.color}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${preset === key ? info.color : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 8, padding: '8px 12px', cursor: scanning ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: preset === key ? info.color : 'rgba(255,255,255,0.7)' }}>{info.label}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{info.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={scanning ? () => { esRef.current?.close(); setScanning(false); setPhase(SCAN_PHASES[0]); } : runScan}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: scanning ? 'rgba(226,75,74,0.2)' : '#1D9E75',
                  color: scanning ? '#E24B4A' : 'white',
                  fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15,
                  transition: 'all 0.2s',
                }}
              >
                {scanning ? '⏹ Stop Scan' : '▶ Run Scan'}
              </button>

              {result && (
                <button
                  onClick={reset}
                  style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}
                >
                  ↺ New Scan
                </button>
              )}
            </div>

            {/* Scan history log */}
            {history.length > 0 && (
              <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Scan History
                </div>
                {history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{h.restaurant_name || 'Unknown'}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{h.ts}</div>
                    </div>
                    <span style={{ background: `${STATUS_COLORS[h.result]}22`, color: STATUS_COLORS[h.result], border: `1px solid ${STATUS_COLORS[h.result]}55`, borderRadius: 20, padding: '2px 10px', fontWeight: 700, fontSize: 10 }}>
                      {h.result?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: Live analysis ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Progress timeline */}
            <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Analysis Pipeline
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${phase.pct || 0}%`, background: result ? STATUS_COLORS[result.result] : '#1D9E75', borderRadius: 4, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  <span>Sample</span><span>Binding</span><span>Signal</span><span>CFU</span><span>Result</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: scanning ? '#1D9E75' : result ? STATUS_COLORS[result.result] : 'rgba(255,255,255,0.3)', fontWeight: 500, minHeight: 20 }}>
                {phase.label || 'Ready to scan'}
              </div>

              {/* Phase step pills */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                {SCAN_PHASES.slice(1).map((p, i) => {
                  const done    = (phase.pct || 0) >= p.pct;
                  const current = phase.id === p.id;
                  return (
                    <div key={p.id} style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500,
                      background: done ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.05)',
                      color: done ? '#1D9E75' : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${done ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.4s',
                    }}>
                      {done ? '✓' : `${i + 1}`} {p.id.replace('_', ' ')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DPV electrode chart */}
            <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Differential Pulse Voltammetry
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {BACTERIA.map((b, i) => (
                    <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                      <div style={{ width: 8, height: 2, background: ['#1D9E75','#378ADD','#EF9F27'][i], borderRadius: 1 }} />
                      {b.aptamer}
                    </div>
                  ))}
                </div>
              </div>
              <ElectrodeChart scanning={scanning} rawNa={rawNa} bacteria={BACTERIA} />
            </div>

            {/* Three bacteria cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
              {BACTERIA.map(b => {
                const level  = levels?.[b.key];
                const nA     = rawNa?.[b.key];
                const cfu    = cfuData?.[b.key];
                const color  = level ? STATUS_COLORS[level] : 'rgba(255,255,255,0.2)';
                return (
                  <div key={b.key} style={{
                    background: '#1a2d45', border: `1px solid ${level ? color + '55' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '1rem', transition: 'border-color 0.5s'
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      {b.aptamer}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', marginBottom: 6, lineHeight: 1.3 }}>
                      {b.label}
                    </div>
                    {nA != null && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
                        {nA.toFixed(2)} nA
                      </div>
                    )}
                    {cfu != null && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                        {cfu > 0 ? `${cfu.toLocaleString()} CFU/mL` : '< 10 CFU/mL'}
                      </div>
                    )}
                    <div style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: level ? `${color}22` : 'rgba(255,255,255,0.05)',
                      color: level ? color : 'rgba(255,255,255,0.3)',
                      border: `1px solid ${level ? color + '55' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {level || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 5, lineHeight: 1.4 }}>
                      Kd {b.kd}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CFU bar chart */}
            {cfuData && (
              <div style={{ background: '#1a2d45', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Concentration (CFU/mL)
                </div>
                {BACTERIA.map((b, i) => (
                  <CFUBar
                    key={b.key}
                    label={b.label}
                    value={cfuData[b.key] || 0}
                    max={maxCFU}
                    color={['#1D9E75','#378ADD','#EF9F27'][i]}
                  />
                ))}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
                  LOD: 10 CFU/mL · Detection range: 10–10⁸ CFU/mL · Sample: 9 µL · GO/PEDOT:PSS electrodes
                </div>
              </div>
            )}

            {/* FINAL RESULT CARD */}
            {result && (
              <div style={{
                background: `${STATUS_COLORS[result.result]}11`,
                border: `2px solid ${STATUS_COLORS[result.result]}66`,
                borderRadius: 16, padding: '1.5rem',
                animation: 'none',
                position: 'relative',
              }}>
                <button
                  onClick={reset}
                  title="Dismiss"
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.45)', borderRadius: 6, width: 26, height: 26,
                    cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                      Final Result — {currentRestaurant?.name}
                    </div>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '2.5rem', fontWeight: 900, color: STATUS_COLORS[result.result], lineHeight: 1 }}>
                      {result.result === 'safe' ? '✅ SAFE' : result.result === 'warning' ? '⚠️ CAUTION' : '🚨 DANGER'}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                      Safety score: <strong style={{ color: 'white' }}>{result.score}/100</strong>
                      &nbsp;·&nbsp; Scan #{scanCount}
                      &nbsp;·&nbsp; {new Date().toLocaleTimeString()}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {BACTERIA.map(b => (
                        <span key={b.key} style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                          background: `${STATUS_COLORS[result[b.key] || 'ND']}22`,
                          color: STATUS_COLORS[result[b.key] || 'ND'],
                          border: `1px solid ${STATUS_COLORS[result[b.key] || 'ND']}55`,
                        }}>
                          {b.aptamer}: {result[b.key] || 'ND'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {result.result === 'safe' && (
                      <button
                        onClick={() => setShowCert(c => !c)}
                        style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                      >
                        {showCert ? 'Hide' : '📋 Show'} QR Certificate
                      </button>
                    )}
                    <Link
                      to={`/verify/${restaurantId}`}
                      target="_blank"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
                    >
                      Open Verify Page ↗
                    </Link>
                  </div>
                </div>

                {/* QR Certificate popup */}
                {showCert && result.result === 'safe' && (
                  <div style={{ marginTop: '1.25rem', background: 'white', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, color: '#0C1B2E', marginBottom: 4, fontSize: 16 }}>
                      Bite<span style={{ color: '#1D9E75' }}>Buddy</span> Certificate
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Food Safety Verified</div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <QRCodeSVG value={`${window.location.origin}/verify/${restaurantId}`} size={120} fgColor="#0C1B2E" />
                    </div>
                    <div style={{ fontWeight: 700, color: '#1D9E75', fontSize: 18 }}>✅ SAFE TO EAT</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{currentRestaurant?.name} · Score: {result.score}/100</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                      <button onClick={() => window.print()} style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        🖨 Print
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
