import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { useToast } from '../lib/toast';

const STATUS_TABS = ['all', 'pending', 'contacted', 'negotiating', 'approved', 'rejected'];

const STATUS_COLORS = {
  pending:     'bg-gray-100 text-gray-600',
  contacted:   'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-600',
};

const PROGRESS_STAGES = [
  { pct: 0,   label: 'New' },
  { pct: 10,  label: 'Contacted' },
  { pct: 30,  label: 'Interested' },
  { pct: 50,  label: 'Negotiating' },
  { pct: 75,  label: 'Agreed' },
  { pct: 100, label: 'Onboarded' },
];

function ProgressBar({ value }) {
  const stage = [...PROGRESS_STAGES].reverse().find(s => value >= s.pct) || PROGRESS_STAGES[0];
  const color = value >= 100 ? '#16a34a' : value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : value >= 10 ? '#3b82f6' : '#9ca3af';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-16 text-right" style={{ color }}>{value}% · {stage.label}</span>
    </div>
  );
}

function ContactModal({ app, onClose, onSent }) {
  const toast = useToast();
  const [subject, setSubject] = useState(`BiteBuddy — Certification for ${app.restaurant_name}`);
  const [message, setMessage] = useState(
`Hi,

We noticed your application for BiteBuddy certification and we're excited to work with you!

${app.restaurant_name} (${app.area}) is exactly the type of establishment our food safety program serves.

Could we schedule a quick call to discuss how our biosensor verification process works and answer any questions?

Best regards,
BiteBuddy Team`
  );
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      await api.post(`/api/admin/applications/${app.id}/contact`, { subject, message });
      toast('Email sent to ' + app.contact_email, 'success');
      onSent();
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to send email', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-head text-xl font-bold text-navy">Contact Restaurant</h2>
            <p className="text-sm text-gray-500 mt-0.5">To: {app.contact_email || '(no email)'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl bg-transparent border-0 cursor-pointer">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Subject</label>
            <input className="input w-full" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Message</label>
            <textarea className="input w-full" rows={9} value={message} onChange={e => setMessage(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={send} disabled={sending || !app.contact_email}
            className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ app, onClose, onApproved }) {
  const toast = useToast();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  async function approve() {
    if (!lat || !lng) { toast('Latitude and longitude are required', 'warning'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/api/admin/applications/${app.id}/approve`, { lat, lng, address });
      toast(`${res.data.restaurant_name} added to the database!`, 'success');
      onApproved();
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to approve', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-head text-xl font-bold text-navy">Approve & Add Restaurant</h2>
            <p className="text-sm text-gray-500 mt-0.5">{app.restaurant_name} · {app.area}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl bg-transparent border-0 cursor-pointer">✕</button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This will add <strong>{app.restaurant_name}</strong> to the restaurant database with <em>pending</em> status, ready for biosensor scanning.
        </p>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Latitude *</label>
              <input className="input w-full" placeholder="e.g. 3.1579" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Longitude *</label>
              <input className="input w-full" placeholder="e.g. 101.7123" value={lng} onChange={e => setLng(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Address</label>
            <input className="input w-full" placeholder="Street address (optional)" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={approve} disabled={loading}
            className="btn-primary text-sm px-5 py-2 disabled:opacity-50" style={{ background: '#16a34a' }}>
            {loading ? 'Adding…' : 'Approve & Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app, onRefresh }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(app.progress ?? 0);
  const [adminNotes, setAdminNotes] = useState(app.admin_notes ?? '');
  const [savingProgress, setSavingProgress] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [approveModal, setApproveModal] = useState(false);

  async function saveProgress() {
    setSavingProgress(true);
    try {
      await api.patch(`/api/admin/applications/${app.id}/progress`, { progress, admin_notes: adminNotes });
      toast('Progress saved', 'success');
      onRefresh();
    } catch {
      toast('Failed to save', 'error');
    } finally {
      setSavingProgress(false);
    }
  }

  async function setStatus(status) {
    try {
      await api.patch(`/api/admin/applications/${app.id}`, { status });
      toast(`Status → ${status}`, 'success');
      onRefresh();
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  const isApproved = app.status === 'approved';

  return (
    <>
      <div className="card p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-head font-bold text-navy text-lg leading-tight">{app.restaurant_name}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                {app.status}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {app.cuisine_type && <span>{app.cuisine_type} · </span>}
              <span>{app.area}</span>
              {app.contacted_at && (
                <span className="ml-2 text-blue-500 text-xs">Contacted {new Date(app.contacted_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <button onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-navy bg-transparent border-0 cursor-pointer flex-shrink-0 pt-1">
            {expanded ? '▲ Less' : '▼ More'}
          </button>
        </div>

        <ProgressBar value={app.progress ?? 0} />

        {expanded && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
            {(app.contact_email || app.contact_phone) && (
              <div className="text-sm text-gray-600">
                {app.contact_email && <div>📧 {app.contact_email}</div>}
                {app.contact_phone && <div>📞 {app.contact_phone}</div>}
              </div>
            )}
            {app.notes && (
              <div className="text-sm bg-gray-50 rounded-lg p-3 text-gray-600">
                <span className="font-semibold text-gray-700">Application notes: </span>{app.notes}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Progress: {progress}%
              </label>
              <input type="range" min="0" max="100" step="5" value={progress}
                onChange={e => setProgress(parseInt(e.target.value))}
                className="w-full accent-green cursor-pointer" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                {PROGRESS_STAGES.map(s => (
                  <span key={s.pct} onClick={() => setProgress(s.pct)} className="cursor-pointer hover:text-navy">{s.label}</span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Admin Notes</label>
              <textarea className="input w-full text-sm" rows={2} placeholder="Internal notes about this application…"
                value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={saveProgress} disabled={savingProgress}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                {savingProgress ? 'Saving…' : 'Save Progress'}
              </button>

              {!isApproved && (
                <>
                  <button onClick={() => setContactModal(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border-0 cursor-pointer font-medium transition">
                    📧 Send Email
                  </button>
                  <button onClick={() => setStatus('negotiating')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border-0 cursor-pointer font-medium transition">
                    Negotiating
                  </button>
                  <button onClick={() => setApproveModal(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 border-0 cursor-pointer font-medium transition">
                    Approve & Add
                  </button>
                  <button onClick={() => setStatus('rejected')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border-0 cursor-pointer font-medium transition">
                    Reject
                  </button>
                </>
              )}
              {isApproved && (
                <span className="text-xs text-green-600 font-semibold py-1.5">Restaurant added to database</span>
              )}
            </div>
          </div>
        )}
      </div>

      {contactModal && (
        <ContactModal app={app} onClose={() => setContactModal(false)} onSent={onRefresh} />
      )}
      {approveModal && (
        <ApproveModal app={app} onClose={() => setApproveModal(false)} onApproved={onRefresh} />
      )}
    </>
  );
}

export default function Applications() {
  const toast = useToast();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/applications');
      setApps(res.data.data);
    } catch {
      toast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tab === 'all' ? apps : apps.filter(a => a.status === tab);

  const counts = STATUS_TABS.reduce((acc, s) => {
    acc[s] = s === 'all' ? apps.length : apps.filter(a => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-head text-3xl font-extrabold text-navy">Restaurant Applications</h1>
          <p className="text-gray-500 mt-1">Manage inbound certification requests and onboarding pipeline</p>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer transition ${
                tab === t ? 'bg-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {counts[t] > 0 && <span className="ml-1.5 opacity-70">({counts[t]})</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1,2,3].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <div className="font-medium">No {tab === 'all' ? '' : tab + ' '}applications</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(app => <AppCard key={app.id} app={app} onRefresh={load} />)}
          </div>
        )}
      </div>
    </div>
  );
}
