import { REQUEST_STATUSES } from '../requestOptions';

const COLORS = {
  pending: { background: '#fef3c7', color: '#92400e' },
  accepted: { background: '#dbeafe', color: '#1e40af' },
  referred: { background: '#ede9fe', color: '#5b21b6' },
  closed: { background: '#e5e7eb', color: '#374151' },
};

function StatusBadge({ status }) {
  const found = REQUEST_STATUSES.find((s) => s.value === status);
  const label = found ? found.label : status;
  const colors = COLORS[status] || { background: '#f3f4f6', color: '#374151' };

  return (
    <span
      style={{
        ...colors,
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export default StatusBadge;