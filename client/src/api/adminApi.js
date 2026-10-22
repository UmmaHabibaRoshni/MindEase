import axios from "axios";

// T8.7 - admin API client (BL-8).
// Every /api/admin route is behind auth + allowRoles('admin'), so the bearer
// token has to go on each call.

const adminApi = axios.create({ baseURL: "/api/admin" });

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turns an axios failure into the server's own message where there is one, so
// the page never shows "Request failed with status code 400".
export function readError(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || fallback;
}

// GET /api/admin/pending-users -> { users: [...] }
export async function getPendingUsers() {
  const res = await adminApi.get("/pending-users");
  return res.data.users || [];
}

// PATCH /api/admin/users/:id/approve -> { message, user }
export async function approveUser(id) {
  const res = await adminApi.patch(`/users/${id}/approve`);
  return res.data.user;
}

// PATCH /api/admin/users/:id/reject  body: { reason } -> { message, user }
// The backend rejects an empty reason with a 400, so it is required here too.
export async function rejectUser(id, reason) {
  const trimmed = (reason || "").trim();
  if (!trimmed) {
    throw new Error("A rejection reason is required.");
  }
  const res = await adminApi.patch(`/users/${id}/reject`, { reason: trimmed });
  return res.data.user;
}

// ---------------------------------------------------------------- T16 (BL-16)

// GET /api/admin/summary -> { users, requests, workshops, referrals }
// T16.3, mine. Used by the dashboard stats page.
export async function getAdminSummary() {
  const res = await adminApi.get("/summary");
  return res.data;
}

// ASSUMED ROUTES for T16.5 (Tanjila) - taken from the sprint sheet line
// "admin users list (filter by role and status) and suspend / reactivate API".
// These must be checked against her implementation when it lands:
//
//   GET    /api/admin/users?role=&status=&q=   -> { users: [...] }
//   PATCH  /api/admin/users/:id/suspend        -> { user }   body: { reason }
//   PATCH  /api/admin/users/:id/reactivate     -> { user }

// Only filters that are actually set are sent, so the query string stays clean
// and an empty dropdown never narrows the list by accident.
export async function getUsers({ role = "", status = "", q = "" } = {}) {
  const params = {};
  if (role) params.role = role;
  if (status) params.status = status;
  if (q.trim()) params.q = q.trim();

  const res = await adminApi.get("/users", { params });
  const data = res.data;
  if (Array.isArray(data)) return data;
  return data?.users || [];
}

// PATCH /api/admin/users/:id/suspend   body: { reason }
export async function suspendUser(id, reason) {
  const trimmed = (reason || "").trim();
  if (!trimmed) {
    throw new Error("A reason is required to suspend an account.");
  }
  const res = await adminApi.patch(`/users/${id}/suspend`, { reason: trimmed });
  return res.data?.user ?? res.data;
}

// PATCH /api/admin/users/:id/reactivate
export async function reactivateUser(id) {
  const res = await adminApi.patch(`/users/${id}/reactivate`);
  return res.data?.user ?? res.data;
}

export default adminApi;
