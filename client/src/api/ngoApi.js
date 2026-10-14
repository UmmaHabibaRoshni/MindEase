import axios from "axios";

// T14.7 - NGO API client (BL-14).
// While Tanjila's referral API (T14.4, T14.5) is not merged, USE_MOCK = true
// serves fake data so the pages can be built and checked.
// When the API is merged, change USE_MOCK to false. Nothing else changes.
const USE_MOCK = true;

const ngoApi = axios.create({ baseURL: "/api/referrals" });

ngoApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turns an axios failure into the server's own message where there is one.
export function readError(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || fallback;
}

// ---- fake data, only used while USE_MOCK is true ----
let mockReferrals = [
  {
    _id: "mock-1",
    status: "pending",
    note: "",
    createdAt: "2026-10-12T09:30:00.000Z",
    request: {
      category: "Mental health",
      urgency: "high",
      description: "Seeker needs counselling support and a safe place to talk.",
    },
  },
  {
    _id: "mock-2",
    status: "in_progress",
    note: "We have contacted the seeker.",
    createdAt: "2026-10-10T14:00:00.000Z",
    request: {
      category: "Legal aid",
      urgency: "medium",
      description: "Seeker is asking for help with a family legal issue.",
    },
  },
  {
    _id: "mock-3",
    status: "resolved",
    note: "Case resolved, seeker connected with a lawyer.",
    createdAt: "2026-10-05T11:15:00.000Z",
    request: {
      category: "Shelter",
      urgency: "low",
      description: "Seeker needed temporary shelter information.",
    },
  },
];

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// GET /api/referrals/mine -> { referrals: [...] }
export async function getMyReferrals() {
  if (USE_MOCK) {
    await wait();
    return mockReferrals.map((r) => ({ ...r }));
  }
  const res = await ngoApi.get("/mine");
  return res.data.referrals || [];
}

// GET /api/referrals/:id -> { referral }   (used by the T14.8 page)
export async function getReferral(id) {
  if (USE_MOCK) {
    await wait();
    const found = mockReferrals.find((r) => r._id === id);
    if (!found) throw new Error("Referral not found.");
    return { ...found };
  }
  const res = await ngoApi.get(`/${id}`);
  return res.data.referral;
}

// PATCH /api/referrals/:id/status  body: { status, note } -> { referral }   (T14.8)
export async function updateReferralStatus(id, { status, note }) {
  if (USE_MOCK) {
    await wait();
    const found = mockReferrals.find((r) => r._id === id);
    if (!found) throw new Error("Referral not found.");
    found.status = status;
    found.note = (note || "").trim();
    return { ...found };
  }
  const res = await ngoApi.patch(`/${id}/status`, { status, note });
  return res.data.referral;
}

export default ngoApi;