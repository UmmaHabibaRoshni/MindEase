import axios from "axios";

// Video room calls for BL-18. Same shape as workshopApi.js and paymentApi.js.
//
// T18.1 decided the room opens in a new tab rather than being embedded, so
// these only ever fetch details - nothing here renders a call.

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const errorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

// The facilitator who owns an online workshop, or a seeker enrolled in it.
export const getWorkshopRoom = (id) =>
  axios.get(`/api/video/workshop/${id}`, authHeaders()).then((r) => r.data);

// The psychologist a case is assigned to, or the seeker on it.
export const getCaseRoom = (id) =>
  axios.get(`/api/video/case/${id}`, authHeaders()).then((r) => r.data);

// The same consultation room, found from the crisis request. The seeker's
// dashboard lists requests and never sees a case id, so this is their way in.
export const getRequestRoom = (id) =>
  axios.get(`/api/video/request/${id}`, authHeaders()).then((r) => r.data);

// Opens the Jitsi room. A new tab, per the T18.1 spike: meet.jit.si asks the
// room creator to sign in, and third-party sign-in inside an iframe is what
// browsers block hardest. noopener so the new tab cannot reach back into ours.
export const openRoom = (url) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

// Picks the right loader for a kind of room, so VideoRoom can be driven by a
// route param without knowing about any of the three endpoints.
export const roomLoaders = {
  workshop: getWorkshopRoom,
  case: getCaseRoom,
  request: getRequestRoom,
};
