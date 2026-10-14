
import axios from "axios";

// All workshop calls in one place. The token is read from localStorage,
// the same way the dashboards already do it.

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// the server's own message when there is one, otherwise a fallback
export const errorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

// ---------- seeker ----------

export const getAvailableWorkshops = () =>
  axios.get("/api/workshops/available", authHeaders()).then((r) => r.data);

export const enrollInWorkshop = (id) =>
  axios.post(`/api/workshops/${id}/enroll`, {}, authHeaders()).then((r) => r.data);

export const cancelEnrollment = (id, reason) =>
  axios
    .delete(`/api/workshops/${id}/enroll`, {
      ...authHeaders(),
      data: reason ? { reason } : {},
    })
    .then((r) => r.data);

// ---------- facilitator ----------

export const createWorkshop = (data) =>
  axios.post("/api/workshops", data, authHeaders()).then((r) => r.data);

export const updateWorkshop = (id, data) =>
  axios.patch(`/api/workshops/${id}`, data, authHeaders()).then((r) => r.data);

export const cancelWorkshop = (id) =>
  axios.patch(`/api/workshops/${id}/cancel`, {}, authHeaders()).then((r) => r.data);