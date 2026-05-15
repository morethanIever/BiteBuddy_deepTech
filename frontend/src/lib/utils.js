export function statusBadgeClass(status) {
  return {
    safe:    'badge-safe',
    warning: 'badge-warning',
    danger:  'badge-danger',
    pending: 'badge-pending',
  }[status] || 'badge-pending';
}

export function statusLabel(status) {
  return {
    safe:    '✅ SAFE',
    warning: '⚠️ CAUTION',
    danger:  '🚨 DANGER',
    pending: '⏳ PENDING',
  }[status] || status?.toUpperCase();
}

export function statusColor(status) {
  return {
    safe:    '#1D9E75',
    warning: '#EF9F27',
    danger:  '#E24B4A',
    pending: '#888780',
  }[status] || '#888780';
}

export function bacteriaColor(value) {
  return { ND: '#1D9E75', Trace: '#EF9F27', Detected: '#E24B4A' }[value] || '#888780';
}

export function formatTimeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-MY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}
