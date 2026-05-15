import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../lib/api';
import { statusBadgeClass, statusLabel, statusColor, bacteriaColor, formatTimeAgo } from '../lib/utils';
import { SkeletonMap } from '../components/Skeleton';

// Fix default leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createPinIcon(status) {
  const colors = { safe: '#1D9E75', warning: '#EF9F27', danger: '#E24B4A', pending: '#888780' };
  const symbols = { safe: '✓', warning: '!', danger: '✗', pending: '?' };
  const color = colors[status] || colors.pending;
  const sym = symbols[status] || '?';
  return L.divIcon({
    className: '',
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -44],
    html: `<div style="
      width:36px;height:36px;background:${color};border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:2.5px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);color:white;font-weight:700;font-size:15px;line-height:1">${sym}</span>
    </div>`,
  });
}

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16, { duration: 1 });
  }, [coords, map]);
  return null;
}

export default function MapPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);

  const fetchRestaurants = useCallback(async () => {
    try {
      const { data } = await api.get('/api/restaurants');
      setRestaurants(data.data);
    } catch {
      setError('Failed to load restaurants. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const filtered = restaurants.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.area.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  function selectRestaurant(r) {
    setSelected(r);
    setFlyTarget([r.lat, r.lng]);
  }

  const counts = {
    safe: restaurants.filter(r => r.status === 'safe').length,
    warning: restaurants.filter(r => r.status === 'warning').length,
    danger: restaurants.filter(r => r.status === 'danger').length,
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="section-title">Safe Restaurant Map</h1>
        <p className="section-sub">Real-time food safety for restaurants tested with BiteBuddy in Kuala Lumpur.</p>

        {loading ? (
          <SkeletonMap />
        ) : error ? (
          <div className="card p-8 text-center text-danger">{error}</div>
        ) : (
          <div className="card overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
              <input
                className="input-field flex-1 min-w-48"
                placeholder="Search restaurant or area…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {['all', 'safe', 'warning', 'danger'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition cursor-pointer ${
                    filterStatus === s
                      ? 'border-green bg-green-light text-green-dark'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {s === 'all' ? `All (${restaurants.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s] || 0})`}
                </button>
              ))}
              <button onClick={fetchRestaurants} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer bg-white text-sm" title="Refresh">↻</button>
            </div>

            {/* Map + Sidebar */}
            <div className="grid md:grid-cols-[1fr_320px]">
              <div className="h-[480px]">
                <MapContainer
                  center={[3.1478, 101.6953]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                  />
                  <FlyTo coords={flyTarget} />
                  {filtered.map(r => (
                    <Marker
                      key={r.id}
                      position={[r.lat, r.lng]}
                      icon={createPinIcon(r.status)}
                      eventHandlers={{ click: () => setSelected(r) }}
                    >
                      <Popup>
                        <div className="min-w-48">
                          <div className="font-semibold text-navy mb-1">{r.name}</div>
                          <div className="text-xs text-gray-400 mb-2">{r.type} · {r.area}</div>
                          <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                          {r.score && (
                            <div className="text-xs text-gray-400 mt-1">Score: {r.score}/100</div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* Sidebar */}
              <div className="border-l border-gray-100 md:h-[480px] overflow-y-auto">
                <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <span className="font-semibold text-sm text-navy">Restaurants</span>
                  <span className="bg-green-light text-green-dark text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No restaurants match your filters.</div>
                ) : filtered.map(r => (
                  <div
                    key={r.id}
                    onClick={() => selectRestaurant(r)}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition ${
                      selected?.id === r.id ? 'bg-green-light' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold text-sm text-navy mb-0.5">{r.name}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">{r.type} · {r.area}</span>
                      <span className={statusBadgeClass(r.status)}>{r.status?.toUpperCase()}</span>
                    </div>
                    {r.score && (
                      <div className="text-xs text-gray-300 mt-1">
                        Score: {r.score}/100 · {formatTimeAgo(r.last_tested_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 p-4 border-t border-gray-100 text-xs text-gray-500">
              {[['safe','#1D9E75','Safe to eat'],['warning','#EF9F27','Use caution'],['danger','#E24B4A','Avoid — risk detected'],['pending','#888780','Not yet tested']].map(([s,c,l])=>(
                <div key={s} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{background:c}} />
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected restaurant detail */}
        {selected && (
          <div className="card p-6 mt-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-head text-xl font-bold text-navy">{selected.name}</h2>
                <div className="text-sm text-gray-400 mt-0.5">{selected.type} · {selected.area}</div>
                {selected.address && <div className="text-xs text-gray-300 mt-0.5">{selected.address}</div>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-xl border-0 bg-transparent cursor-pointer">×</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {['ecoli','staph','bcereus'].map(b => (
                <div key={b} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 italic mb-1">
                    {b === 'ecoli' ? 'Salmonella spp.' : b === 'ecoli' ? 'E. coli O157:H7' : 'Staph. aureus'}
                  </div>
                  <div className="font-semibold text-sm" style={{color: bacteriaColor(selected[b])}}>
                    {selected[b] || '—'}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`${statusBadgeClass(selected.status)} text-sm px-4 py-2`}>{statusLabel(selected.status)}</span>
              {selected.score && <span className="text-sm text-gray-400">Score: <strong>{selected.score}/100</strong></span>}
              <span className="text-sm text-gray-400">Tested {formatTimeAgo(selected.last_tested_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
