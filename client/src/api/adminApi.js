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

export default adminApi;
