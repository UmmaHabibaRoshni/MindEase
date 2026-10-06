// CATEGORIES / URGENCY_LEVELS / REQUEST_STATUSES values must match server/models/CrisisRequest.js
// RESOURCE_TYPES values must match the type enum in server/models/Resource.js

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

export const REFERRAL_STATUSES = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed'
};

export const RESOURCE_TYPES = [
  { value: 'helpline', label: 'Helpline' },
  { value: 'article', label: 'Article' },
];