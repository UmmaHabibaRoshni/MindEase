import axios from "axios";

// Payment calls for BL-17 (T17.8). Same shape as workshopApi.js: the token
// comes from localStorage and the server's own message is used when there is one.

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const errorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

// Starts a payment for a paid workshop and returns the gateway URL to send the
// seeker to. The seat is NOT taken here: the backend enrolls the seeker only
// after SSLCommerz confirms the payment (T17.4), so nothing is reserved while
// the seeker is on the gateway page.
export const startWorkshopPayment = (id) =>
  axios.post(`/api/workshops/${id}/pay`, {}, authHeaders()).then((r) => r.data);

// Leaving the SPA for the gateway. A plain assignment rather than window.open
// so it is not eaten by a popup blocker - the seeker came back to /payment/...
// afterwards either way.
export const goToGateway = (url) => {
  window.location.assign(url);
};
