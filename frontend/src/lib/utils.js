// Correct bacteria names matching the actual aptamer biosensor
export const BACTERIA_INFO = {
  ecoli:   { label: 'E. coli O157:H7', aptamer: 'S1-2',   kd: '8.79 nM',  italic: true  },
  staph:   { label: 'S. aureus',        aptamer: 'SA43-3', kd: '14.2 nM',  italic: true  },
  bcereus: { label: 'B. cereus',        aptamer: 'BC-1',   kd: '28.34 nM', italic: true  },
};

export function statusBadgeClass(status) {
  return { safe:'badge-safe', warning:'badge-warning', danger:'badge-danger', pending:'badge-pending' }[status] || 'badge-pending';
}

export function statusLabel(status) {
  return { safe:'✅ SAFE', warning:'⚠️ CAUTION', danger:'🚨 DANGER', pending:'⏳ PENDING' }[status] || (status || '').toUpperCase();
}

export function statusColor(status) {
  return { safe:'#1D9E75', warning:'#EF9F27', danger:'#E24B4A', pending:'#888780' }[status] || '#888780';
}

export function bacteriaColor(value) {
  return { ND:'#1D9E75', Trace:'#EF9F27', Detected:'#E24B4A' }[value] || '#888780';
}

export function formatTimeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-MY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
