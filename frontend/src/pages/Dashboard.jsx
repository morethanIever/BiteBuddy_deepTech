import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../lib/toast';
import { statusBadgeClass, statusLabel, bacteriaColor, formatTimeAgo, formatDateTime } from '../lib/utils';
import { SkeletonCard, SkeletonRow } from '../components/Skeleton';

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-head text-4xl font-extrabold mb-1" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ items, max }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(([label, val, color]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <div className="w-20 text-gray-400 text-right text-xs">{label}</div>
          <div className="flex-1 bg-gray-100 rounded h-2 overflow-hidden">
            <div
              className="bar-animated h-full rounded"
              style={{ width: `${Math.round((val / max) * 100)}%`, background: color }}
            />
          </div>
          <div className="w-6 font-semibold text-navy text-xs">{val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Simulate Panel ────────────────────────────────────────────────────────────
function SimulatePanel({ restaurants, onResult }) {
  const toast = useToast();
  const [restaurantId, setRestaurantId] = useState('');
  const [preset, setPreset] = useState('safe');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function simulate() {
    if (!restaurantId) { toast('⚠️ Select a restaurant first', 'warning'); return; }
    setLoading(true); setProgress(0);

    // Animate progress bar
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 90) { clearInterval(iv); return p; }
        return p + Math.random() * 15 + 3;
      });
    }, 200);

    try {
      const { data } = await api.post('/api/scans/simulate', {
        restaurant_id: parseInt(restaurantId),
        preset,
      });
      clearInterval(iv); setProgress(100);
      toast(`📡 Scan sent: ${data.data.restaurant_name} → ${data.data.result.toUpperCase()}`, 'success');
      onResult?.(data);
    } catch (err) {
      toast(err.response?.data?.error || 'Simulation failed', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1500);
    }
  }

  return (
    <div className="card p-5">
      <div className="font-semibold text-sm text-navy mb-4">🔬 Simulate a Device Scan</div>
      <div className="flex flex-col gap-3">
        <select
          className="input-field"
          value={restaurantId}
          onChange={e => setRestaurantId(e.target.value)}
        >
          <option value="">Select restaurant…</option>
          {restaurants.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.area})</option>
          ))}
        </select>
        <div className="flex gap-2">
          {['safe','warning','danger'].map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                preset === p
                  ? p === 'safe' ? 'bg-green-light border-green text-green-dark'
                  : p === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                  : 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {p === 'safe' ? '✅' : p === 'warning' ? '⚠️' : '🚨'} {p.toUpperCase()}
            </button>
          ))}
        </div>
        {progress > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Biosensor analysis…</span><span>{Math.round(Math.min(progress, 100))}%</span>
            </div>
            <div className="bg-gray-100 rounded h-2 overflow-hidden">
              <div className="h-full bg-green rounded bar-animated transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        )}
        <button onClick={simulate} disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? 'Scanning…' : '🚀 Run Simulation'}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, restRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/restaurants'),
      ]);
      setStats(statsRes.data.data);
      setRecentScans(statsRes.data.data.recent_scans || []);
      setRestaurants(restRes.data.data);
    } catch {
      toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Refresh stats every 30 seconds
  useEffect(() => {
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  // WebSocket for live scan feed
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'connection_status') {
      setWsConnected(msg.payload.connected);
    } else if (msg.type === 'scan_result') {
      const scan = msg.payload;
      setRecentScans(prev => [scan, ...prev].slice(0, 10));
      // Update stats counts
      setStats(prev => prev ? {
        ...prev,
        scans_today: (prev.scans_today || 0) + 1,
        safe_count: prev.safe_count + (scan.result === 'safe' ? 1 : 0),
        warning_count: prev.warning_count + (scan.result === 'warning' ? 1 : 0),
        danger_count: prev.danger_count + (scan.result === 'danger' ? 1 : 0),
      } : prev);
      toast(`📡 Live: ${scan.restaurant_name} → ${scan.result.toUpperCase()}`, scan.result === 'safe' ? 'success' : 'error');
    }
  }, [toast]));

  if (loading) {
    return (
      <div className="pt-16 max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const statMax = Math.max(stats?.safe_count || 1, 1);

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
          <div>
            <h1 className="section-title mb-1">Admin Dashboard</h1>
            <div className="text-sm text-gray-400">Kuala Lumpur · Live data</div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              wsConnected ? 'bg-green-light text-green-dark' : 'bg-gray-100 text-gray-400'
            }`}>
              <span className={`w-2 h-2 rounded-full block ${wsConnected ? 'bg-green pulse-dot' : 'bg-gray-400'}`} />
              {wsConnected ? `${restaurants.length} devices online` : 'Connecting…'}
            </div>
            <button onClick={fetchStats} className="btn-outline text-sm px-4 py-2">↻ Refresh</button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Restaurants" value={stats?.total_restaurants} sub="In system" color="#0C1B2E" />
          <StatCard label="Safe" value={stats?.safe_count} sub={`${Math.round((stats?.safe_count / stats?.total_restaurants) * 100) || 0}% pass rate`} color="#1D9E75" />
          <StatCard label="Warnings" value={stats?.warning_count} sub="Requires attention" color="#EF9F27" />
          <StatCard label="Danger" value={stats?.danger_count} sub="Action needed" color="#E24B4A" />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Scans Today" value={stats?.scans_today} color="#378ADD" />
          <StatCard label="Pending" value={stats?.pending_count} color="#888780" />
          <StatCard label="Applications" value={stats?.pending_applications} sub="Awaiting review" color="#7F77DD" />
          <StatCard label="Live Connections" value={stats?.live_connections} color="#1D9E75" />
        </div>

        {/* Main body */}
        <div className="grid md:grid-cols-[1fr_360px] gap-6">
          {/* Scan log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-sm">Live Scan Feed</span>
              <span className="text-xs text-gray-400">{new Date().toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            {recentScans.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No scans yet. Run a simulation to see live data.</div>
            ) : recentScans.map((scan, i) => (
              <div key={scan.id || i} className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition">
                <div>
                  <div className="font-semibold text-sm text-navy">{scan.restaurant_name}</div>
                  <div className="text-xs text-gray-300">{scan.restaurant_area} · {formatTimeAgo(scan.created_at)}</div>
                  <div className="flex gap-2 mt-1">
                    {['salmonella','ecoli','staph'].map(b => scan[b] && (
                      <span key={b} className="text-xs" style={{ color: bacteriaColor(scan[b]) }}>{scan[b]}</span>
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

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Simulate */}
            <SimulatePanel restaurants={restaurants} onResult={fetchStats} />

            {/* Status breakdown */}
            <div className="card p-5">
              <div className="font-semibold text-sm mb-4">Status Breakdown</div>
              <BarChart
                max={stats?.total_restaurants || 1}
                items={[
                  ['Safe', stats?.safe_count || 0, '#1D9E75'],
                  ['Warning', stats?.warning_count || 0, '#EF9F27'],
                  ['Danger', stats?.danger_count || 0, '#E24B4A'],
                  ['Pending', stats?.pending_count || 0, '#888780'],
                ]}
              />
            </div>

            {/* Top areas */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Top Safe Areas</div>
              {(stats?.top_areas || []).map(a => (
                <div key={a.area} className="flex justify-between px-5 py-2.5 border-b border-gray-50 text-sm">
                  <span className="text-navy">{a.area}</span>
                  <span className="text-green font-semibold">{a.safe_count}/{a.total} safe</span>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="card p-4 flex flex-col gap-2">
              <Link to="/map" className="text-sm text-green hover:underline no-underline font-medium">→ View Public Map</Link>
              <a href="/api/admin/applications" target="_blank" className="text-sm text-green hover:underline font-medium">→ Review Applications (API)</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
