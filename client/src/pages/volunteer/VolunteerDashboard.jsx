import { useEffect, useState } from "react";
import axios from "axios";

export default function VolunteerDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAccept = async (id) => {
    setMessage("");
    setError("");
    try {
      await axios.patch(`/api/requests/${id}/accept`, {}, authConfig());
      setMessage("Request accepted.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not accept the request.");
    }
    await loadRequests();
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 900 }}>
      <h1>Volunteer Dashboard</h1>
      <p>Pending support requests you can accept.</p>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && requests.length === 0 && !error && <p>No pending requests.</p>}

      {requests.map((r) => (
        <div
          key={r._id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fff",
          }}
        >
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
