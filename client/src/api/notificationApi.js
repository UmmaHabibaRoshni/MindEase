import axios from "axios";

// T15.7 (BL-15) - notification API client.
//
// The routes are behind auth, so the bearer token goes on every call, the same
// way adminApi.js does it.
//
// ASSUMED ROUTES - these come from the T15.3 line in the sprint sheet ("APIs to
// list my notifications, get unread count, mark one and mark all read") and
// must be checked against Tanjila's implementation when it lands:
//
//   GET    /api/notifications              -> { notifications: [...] }
//   GET    /api/notifications/unread-count -> { count: n }
//   PATCH  /api/notifications/:id/read     -> { notification }
//   PATCH  /api/notifications/read-all     -> { modified: n }
//
// Every reader below accepts more than one response shape on purpose. A list
// endpoint in this project has already shipped twice as a bare array and twice
// wrapped in an object, and reading the wrong one is why the resource library
// rendered nothing for a week.

const notificationApi = axios.create({ baseURL: "/api/notifications" });

notificationApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function readError(err, fallback = "Could not load notifications.") {
  return err?.response?.data?.message || fallback;
}

// Accepts a bare array, { notifications }, or { data }.
function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

// GET /api/notifications
export async function getNotifications() {
  const res = await notificationApi.get("/");
  return asList(res.data);
}

// GET /api/notifications/unread-count
// Falls back to counting the list if the endpoint answers in another shape, so
// the badge is never blank just because a field was renamed.
export async function getUnreadCount() {
  const res = await notificationApi.get("/unread-count");
  const data = res.data;
  const value = typeof data === "number" ? data : data?.count ?? data?.unread ?? data?.unreadCount;
  return Number.isFinite(value) ? value : asList(data).filter((n) => !n.read).length;
}

// PATCH /api/notifications/:id/read
export async function markRead(id) {
  if (!id) throw new Error("A notification id is required.");
  const res = await notificationApi.patch(`/${id}/read`);
  return res.data?.notification ?? res.data;
}

// PATCH /api/notifications/read-all
export async function markAllRead() {
  const res = await notificationApi.patch("/read-all");
  return res.data;
}

export default notificationApi;
