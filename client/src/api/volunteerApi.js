
import axios from "axios";

// T10.7 - volunteer API client (BL-10).
// Every /api/volunteer route is behind auth + allowRoles('volunteer'), so the
// bearer token has to go on each call.

const volunteerApi = axios.create({ baseURL: "/api/volunteer" });

volunteerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shows the server's own message where there is one.
export function readError(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || fallback;
}

// GET /api/volunteer/availability -> { success, availability }
export async function getMyAvailability() {
  const res = await volunteerApi.get("/availability");
  return res.data.availability;
}

// PATCH /api/volunteer/availability
// body: any of { isAvailable, dayOfWeek, startTime, endTime } -> { message, availability }
export async function updateAvailability(fields) {
  const res = await volunteerApi.patch("/availability", fields);
  return res.data.availability;
}

export default volunteerApi;