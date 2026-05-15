import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../lib/api';
import { statusLabel, bacteriaColor, formatDateTime } from '../lib/utils';

const BACTERIA = [
  { key: 'ecoli',   label: 'E. coli O157:H7', desc: 'Causes HUS, severe diarrhea', aptamer: 'S1-2'   },
  { key: 'staph',   label: 'S. aureus',        desc: 'Causes food poisoning',        aptamer: 'SA43-3' },
  { key: 'bcereus', label: 'B. cereus',        desc: 'Produces emetic toxins',       aptamer: 'BC-1'   },
];

const STATUS_STYLES = {
  safe:    { bg:'bg-green-light',  border:'border-green',       text:'text-green-dark', icon:'✅' },
  warning: { bg:'bg-yellow-50',    border:'border-yellow-300',  text:'text-yellow-800', icon:'⚠️' },
  danger:  { bg:'bg-red-50',       border:'border-red-300',     text:'text-red-800',    icon:'🚨' },
  pending: { bg:'bg-gray-100',     border:'border-gray-300',    text:'text-gray-600',   icon:'⏳' },
};

export default function VerifyPage() {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    api.get(`/api/restaurants/verify/${id}`)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.status === 404 ? 'Restaurant not found or not yet tested.' : 'Could not load verification data.'))
      .finally(() => setLoading(false));
  }, [id]);

  const verifyUrl = `${window.location.origin}/verify/${id}`;
  const style = data ? (STATUS_STYLES[data.status] || STATUS_STYLES.pending) : STATUS_STYLES.pending;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-4xl mb-4 animate-pulse">🦠</div><div className="text-gray-400 text-sm">Loading…</div></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-4">❓</div>
        <h2 className="font-head text-xl font-bold mb-2 text-navy">Not Found</h2>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <Link to="/map" className="btn-primary no-underline">View Safe Map</Link>
      </div>
    </div>
  );

  const scan = data.latest_scan;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center">
      <div id="qr-certificate" className="card max-w-md w-full p-8 shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-head text-2xl font-extrabold text-navy mb-0.5">
            Bite<span className="text-green">Buddy</span>
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-widest">Food Safety Certificate</div>
          <div className="text-xs text-gray-300 mt-1">Multiplex Biosensor · UMIP PI-2024002131</div>
        </div>

        {/* Status */}
        <div className={`${style.bg} border-2 ${style.border} rounded-xl p-5 text-center mb-6`}>
          <div className="text-4xl mb-2">{style.icon}</div>
          <div className={`font-head text-3xl font-extrabold ${style.text}`}>{statusLabel(data.status)}</div>
          {data.score && <div className={`text-sm ${style.text} opacity-70 mt-1`}>Safety Score: {data.score}/100</div>}
        </div>

        {/* Restaurant */}
        <div className="mb-6">
          <h1 className="font-head text-xl font-bold text-navy mb-1">{data.name}</h1>
          <div className="text-sm text-gray-400">{data.type} · {data.area}</div>
          {data.address && <div className="text-xs text-gray-300 mt-0.5">{data.address}</div>}
        </div>

        {/* Bacteria results */}
        {scan && (
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Aptamer Detection Results
            </div>
            {BACTERIA.map(b => (
              <div key={b.key} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium italic text-navy">{b.label}</div>
                  <div className="text-xs text-gray-300">{b.desc} · aptamer {b.aptamer}</div>
                </div>
                <span className="text-sm font-bold" style={{ color: bacteriaColor(scan[b.key]) }}>
                  {scan[b.key] || '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-300 mb-6">
          Last tested: <strong className="text-gray-400">{formatDateTime(data.verified_at)}</strong>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-2 py-4 border-t border-gray-100">
          <QRCodeSVG value={verifyUrl} size={120} fgColor="#0C1B2E" />
          <div className="text-xs text-gray-300 text-center break-all">{verifyUrl}</div>
          <div className="text-xs text-gray-400 font-medium">Scan to verify this certificate</div>
        </div>

        <div className="text-center text-xs text-gray-300 mt-4 pt-4 border-t border-gray-100">
          Powered by <strong>BiteBuddy</strong> · GO/PEDOT:PSS electrodes · LOD 10 CFU/mL
        </div>
      </div>

      <div className="flex gap-3 mt-6 no-print">
        <button onClick={() => window.print()} className="btn-primary px-6 py-2.5">🖨 Print Certificate</button>
        <Link to="/map" className="btn-outline no-underline px-6 py-2.5">View Safe Map</Link>
      </div>

      {data.status !== 'safe' && (
        <div className="card max-w-md w-full mt-4 p-4 border-red-200 no-print">
          <div className="text-sm text-red-700 font-medium">
            ⚠️ This restaurant has not passed the safety threshold.
            Consider choosing from our <Link to="/map" className="text-green underline">Safe Map</Link>.
          </div>
        </div>
      )}
    </div>
  );
}
