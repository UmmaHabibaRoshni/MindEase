import { useEffect, useState } from "react";
import axios from "axios";
import ChatWindow from "../../components/chat/ChatWindow";
import Availability from "../../components/Availability";
import ReferNgoPanel from "../../components/referral/ReferNgoPanel";
import EscalatePanel from "../../components/escalation/EscalatePanel";
import { getUserIdFromToken } from "../../utils/getUserId";

// Same short reference the seeker sees on their own dashboard, so the two
// sides of a conversation can name the case the same way.
const refOf = (r) => (r?._id ? `REQ-${String(r._id).slice(-5).toUpperCase()}` : "REQ-?????");

const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
  background: "#fff",
};

const caseRef = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "#2f6b3a",
};

const referredBadge = {
  backgroundColor: "#c6f6d5",
  color: "#22543d",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
};

const escalatedBadge = {
  backgroundColor: "#bee3f8",
  color: "#2a4365",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
};

export default function VolunteerDashboard() {
  const [requests, setRequests] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [chatRequestId, setChatRequestId] = useState(null);
  const [referRequestId, setReferRequestId] = useState(null);
  const [escalateRequestId, setEscalateRequestId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentUserId = getUserIdFromToken();

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadRequests = async () => {
    try {
      const res = await axios.get("/api/requests/pending", authConfig());
      const list = Array.isArray(res.data) ? res.data : res.data.requests || [];
      setRequests(list);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load requests.");
    } finally {
      setLoading(false);
    }
  };

  const loadAccepted = async () => {
    try {
      const res = await axios.get("/api/requests/accepted", authConfig());
      const list = Array.isArray(res.data) ? res.data : res.data.requests || [];
      setAccepted(list);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load accepted cases.");
    }
  };

  useEffect(() => {
    loadRequests();
    loadAccepted();
  }, []);

  const handleAccept = async (id) => {
    setMessage("");
    setError("");
    try {
      await axios.patch(`/api/requests/${id}/accept`, {}, authConfig());
      setMessage("Request accepted. You can now open the chat above.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not accept the request.");
    }
    await loadRequests();
    await loadAccepted();
  };

  // called by ReferNgoPanel after a successful referral
  // Both confirmations name the case. They appear at the top of the page,
  // far from the card that was acted on, so "Referral sent." on its own left
  // you guessing which of your open cases had just moved.
  const handleReferred = async (r) => {
    setReferRequestId(null);
    setError("");
    setMessage(`${refOf(r)} referred to the NGO. The seeker has been notified.`);
    await loadAccepted(); // the case now comes back as "referred"
  };

  // called by EscalatePanel after a successful referral to a psychologist
  const handleEscalated = async (r) => {
    setEscalateRequestId(null);
    setError("");
    setMessage(`${refOf(r)} referred to the psychologist.`);
    await loadAccepted(); // the case now comes back as "escalated"
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 900 }}>
      <h1>Volunteer Dashboard</h1>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <Availability />

      <h2>Your accepted cases</h2>
      {accepted.length === 0 && <p>No accepted cases yet.</p>}
      {accepted.map((r) => (
        <div key={r._id} style={card}>
          <code style={caseRef}>{refOf(r)}</code>{" "}
          <strong>{r.category}</strong> - Urgency: {r.urgency}{" "}
          {r.status === "referred" && <span style={referredBadge}>Referred</span>}
          {r.status === "escalated" && <span style={escalatedBadge}>Escalated</span>}
          <p>{r.description}</p>
          <small>Submitted: {new Date(r.createdAt).toLocaleDateString()}</small>

          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setChatRequestId(chatRequestId === r._id ? null : r._id)}
            >
              {chatRequestId === r._id ? "Close chat" : "Open chat"}
            </button>
            {r.status === "accepted" && (
              <>
                <button
                  onClick={() => {
                    setEscalateRequestId(null);
                    setReferRequestId(referRequestId === r._id ? null : r._id);
                  }}
                >
                  {referRequestId === r._id ? "Close" : "Refer to NGO"}
                </button>
                <button
                  onClick={() => {
                    setReferRequestId(null);
                    setEscalateRequestId(escalateRequestId === r._id ? null : r._id);
                  }}
                >
                  {escalateRequestId === r._id ? "Close" : "Refer to psychologist"}
                </button>
              </>
            )}
          </div>

          {referRequestId === r._id && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
              <ReferNgoPanel
                requestId={r._id}
                defaultCategory={r.category}
                onReferred={() => handleReferred(r)}
              />
            </div>
          )}

          {escalateRequestId === r._id && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
              <EscalatePanel requestId={r._id} onEscalated={() => handleEscalated(r)} />
            </div>
          )}

          {/* The chat belongs to this case, so it lives inside this case.
              It used to render once at the bottom of the whole list with the
              fixed title "Chat with the seeker" - so with more than one case
              open there was nothing on screen saying which conversation you
              were reading, and referring a case scrolled you away from it. */}
          {chatRequestId === r._id && (
            <div style={{ marginTop: "1rem" }}>
              <ChatWindow
                requestId={r._id}
                currentUserId={currentUserId}
                title={`Chat - ${refOf(r)} - ${r.category}`}
              />
            </div>
          )}
        </div>
      ))}

      <h2>Pending requests</h2>
      <p>Pending support requests you can accept.</p>
      {loading && <p>Loading...</p>}
      {!loading && requests.length === 0 && !error && <p>No pending requests.</p>}

      {requests.map((r) => (
        <div key={r._id} style={card}>
          <strong>{r.category}</strong> - Urgency: {r.urgency}
          <p>{r.description}</p>
          <small>Submitted: {new Date(r.createdAt).toLocaleDateString()}</small>
          <div style={{ marginTop: "0.75rem" }}>
            <button onClick={() => handleAccept(r._id)}>Accept</button>
          </div>
        </div>
      ))}
    </div>
  );
}