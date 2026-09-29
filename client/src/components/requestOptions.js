// Values must match CATEGORIES / URGENCY_LEVELS in server/models/CrisisRequest.js
// value = sent to server, label = shown in the UI

export const CATEGORIES = [
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'abuse_violence', label: 'Abuse / Violence' },
  { value: 'legal_aid', label: 'Legal Aid' },
  { value: 'medical', label: 'Medical' },
  { value: 'substance_use', label: 'Substance Use' },
  { value: 'other', label: 'Other' },
];

export const URGENCY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
export const REQUEST_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'referred', label: 'Referred' },
  { value: 'closed', label: 'Closed' },
];

export const REFERRAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];