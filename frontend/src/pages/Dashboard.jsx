import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../lib/toast';
import { statusBadgeClass, bacteriaColor, formatTimeAgo } from '../lib/utils';
import { SkeletonCard } from '../components/Skeleton';

const BACTERIA = [
  { key: 'ecoli',   short: 'E.coli' },
  { key: 'staph',   short: 'S.aureus' },
  { key: 'bcereus', short: 'B.cereus' },
];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-head text-4xl font-extrabold mb-1" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function BarChart({ items, max }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(([label, val, color]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <div className="w-20 text-gray-400 text-right text-xs">{label}</div>
          <div className="flex-1 bg-gray-100 rounded h-2 overflow-hidden">
            <div className="bar-animated h-full rounded"
              style={{ width: `${Math.round((val / Math.max(max,1)) * 100)}%`, background: color }} />
          </div>
          <div className="w-6 font-semibold text-navy text-xs">{val}</div>
        </div>
      ))}
    </div>
  );
}

function SimulatePanel({ restaurants, onResult }) {
  const toast = useToast();
  const [rid, setRid]         = useState('');
  const [preset, setPreset]   = useState('safe');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function simulate() {
    if (!rid) { toast('⚠️ Select a restaurant', 'warning'); return; }
    setLoading(true); setProgress(0);
    const iv = setInterval(() => setProgress(p => p >= 90 ? p : p + Math.random() * 15 + 3), 200);
    try {
      const { data } = await api.post('/api/scans/simulate', { restaurant_id: parseInt(rid), preset });
      clearInterval(iv); setProgress(100);
      toast(`📡 ${data.data.restaurant_name} → ${data.data.result.toUpperCase()}`, data.data.result === 'safe' ? 'success' : 'error');
      onResult?.();
    } catch (e) {
      toast(e.response?.data?.error || 'Simulation failed', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1500);
    }
  }

  return (
    <div className="card p-5">
      <div className="font-semibold text-sm text-navy mb-4">🔬 Simulate Device Scan</div>
      <div className="flex flex-col gap-3">
        <select className="input-field" value={rid} onChange={e => setRid(e.target.value)}>
          <option value="">Select restaurant…</option>
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name} ({r.area})</option>)}
        </select>
        <div className="flex gap-2">
          {['safe','warning','danger'].map(p => (
            <button key={p} onClick={() => setPreset(p)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                preset === p
                  ? p === 'safe'    ? 'bg-green-light  border-green    text-green-dark'
                  : p === 'warning' ? 'bg-yellow-50    border-yellow-300 text-yellow-800'
                  :                   'bg-red-50       border-red-300   text-red-800'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}>
              {p === 'safe' ? '✅' : p === 'warning' ? '⚠️' : '🚨'} {p.toUpperCase()}
            </button>
          ))}
        </div>
        {progress > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Biosensor…</span><span>{Math.round(Math.min(progress,100))}%</span></div>
            <div className="bg-gray-100 rounded h-2 overflow-hidden">
              <div className="h-full bg-green rounded transition-all duration-300" style={{ width: `${Math.min(progress,100)}%` }} />
            </div>
          </div>
        )}
        <button onClick={simulate} disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? 'Scanning…' : '🚀 Run Simulation'}
        </button>
        <Link to="/simulator" className="text-center text-xs text-green hover:underline no-underline font-medium">
          → Open full device simulator
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats]         = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/restaurants'),
      ]);
      setStats(sRes.data.data);
      setRecentScans(sRes.data.data.recent_scans || []);
      setRestaurants(rRes.data.data);
    } catch { toast('Failed to load dashboard data', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { const iv = setInterval(fetchStats, 30000); return () => clearInterval(iv); }, [fetchStats]);

  useWebSocket(useCallback((msg) => {
    if (msg.type === 'connection_status') {
      setWsConnected(msg.payload.connected);
    } else if (msg.type === 'scan_result') {
      const scan = msg.payload;
      setRecentScans(prev => [scan, ...prev].slice(0, 10));
      setStats(prev => prev ? {
        ...prev, scans_today: (prev.scans_today || 0) + 1,
        safe_count:    prev.safe_count    + (scan.result === 'safe'    ? 1 : 0),
        warning_count: prev.warning_count + (scan.result === 'warning' ? 1 : 0),
        danger_count:  prev.danger_count  + (scan.result === 'danger'  ? 1 : 0),
      } : prev);
      toast(`📡 ${scan.restaurant_name} → ${scan.result.toUpperCase()}`, scan.result === 'safe' ? 'success' : 'error');
    }
  }, [toast]));

  if (loading) return (
    <div className="pt-16 max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
          <div>
            <h1 className="section-title mb-1">Admin Dashboard</h1>
            <div className="text-sm text-gray-400">Kuala Lumpur · Live data</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/simulator" className="btn-primary text-sm px-4 py-2 no-underline">
              🔬 Device Simulator
            </Link>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${wsConnected ? 'bg-green-light text-green-dark' : 'bg-gray-100 text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full block ${wsConnected ? 'bg-green pulse-dot' : 'bg-gray-400'}`} />
              {wsConnected ? 'Live' : 'Connecting…'}
            </div>
            <button onClick={fetchStats} className="btn-outline text-sm px-4 py-2">↻</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Restaurants" value={stats?.total_restaurants} color="#0C1B2E" />
          <StatCard label="Safe"    value={stats?.safe_count}    sub={`${Math.round((stats?.safe_count / stats?.total_restaurants) * 100) || 0}% pass rate`} color="#1D9E75" />
          <StatCard label="Caution" value={stats?.warning_count} sub="Requires review"  color="#EF9F27" />
          <StatCard label="Danger"  value={stats?.danger_count}  sub="Action needed"    color="#E24B4A" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Scans Today"   value={stats?.scans_today}         color="#378ADD" />
          <StatCard label="Pending"       value={stats?.pending_count}       color="#888780" />
          <StatCard label="Applications"  value={stats?.pending_applications} color="#7F77DD" />
          <StatCard label="Live Clients"  value={stats?.live_connections}    color="#1D9E75" />
        </div>

        <div className="grid md:grid-cols-[1fr_360px] gap-6">
          {/* Scan log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-sm">Live Scan Feed</span>
              <span className="text-xs text-gray-400">{wsConnected ? '● Live' : 'polling'}</span>
            </div>
            {recentScans.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No scans yet — run the device simulator.</div>
            ) : recentScans.map((scan, i) => (
              <div key={scan.id || i} className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50">
                <div>
                  <div className="font-semibold text-sm text-navy">{scan.restaurant_name}</div>
                  <div className="text-xs text-gray-300">{scan.restaurant_area} · {formatTimeAgo(scan.created_at)}</div>
                  <div className="flex gap-2 mt-1">
                    {BACTERIA.map(b => scan[b.key] && (
                      <span key={b.key} className="text-xs font-medium" style={{ color: bacteriaColor(scan[b.key]) }}>
                        {b.short}: {scan[b.key]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className={statusBadgeClass(scan.result)}>{scan.result?.toUpperCase()}</span>
                  <div className="text-xs text-gray-300 mt-1">{scan.score}/100</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <SimulatePanel restaurants={restaurants} onResult={fetchStats} />
            <div className="card p-5">
              <div className="font-semibold text-sm mb-4">Status Breakdown</div>
              <BarChart max={stats?.total_restaurants || 1} items={[
                ['Safe',    stats?.safe_count    || 0, '#1D9E75'],
                ['Caution', stats?.warning_count || 0, '#EF9F27'],
                ['Danger',  stats?.danger_count  || 0, '#E24B4A'],
                ['Pending', stats?.pending_count || 0, '#888780'],
              ]} />
            </div>
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Top Safe Areas</div>
              {(stats?.top_areas || []).map(a => (
                <div key={a.area} className="flex justify-between px-5 py-2.5 border-b border-gray-50 text-sm">
                  <span>{a.area}</span>
                  <span className="text-green font-semibold">{a.safe_count}/{a.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
