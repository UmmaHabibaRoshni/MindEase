
import { useEffect, useState } from "react";
import axios from "axios";
import ChatWindow from "../../components/chat/ChatWindow";
import Availability from "../../components/Availability";
import { getUserIdFromToken } from "../../utils/getUserId";

const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
  background: "#fff",
};

export default function VolunteerDashboard() {
  const [requests, setRequests] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [chatRequestId, setChatRequestId] = useState(null);
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
          <strong>{r.category}</strong> · Urgency: {r.urgency}
          <p>{r.description}</p>
          <small>Submitted: {new Date(r.createdAt).toLocaleDateString()}</small>
          <div style={{ marginTop: "0.75rem" }}>
            <button onClick={() => setChatRequestId(r._id)}>Open chat</button>
          </div>
        </div>
      ))}

      {chatRequestId && (
        <div style={{ margin: "1rem 0 2rem" }}>
          <ChatWindow
            requestId={chatRequestId}
            currentUserId={currentUserId}
            title="Chat with the seeker"
          />
        </div>
      )}

      <h2>Pending requests</h2>
      <p>Pending support requests you can accept.</p>
      {loading && <p>Loading...</p>}
      {!loading && requests.length === 0 && !error && <p>No pending requests.</p>}

      {requests.map((r) => (
        <div key={r._id} style={card}>
          <strong>{r.category}</strong> · Urgency: {r.urgency}
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