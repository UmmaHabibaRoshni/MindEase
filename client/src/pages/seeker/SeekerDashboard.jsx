import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import ChatWindow from "../../components/chat/ChatWindow";

export default function SeekerDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || { id: "seeker_user" };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // Token না থাকলে হ্যান্ডেল করবে
      if (!token) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      const res = await axios.get("/api/requests/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // API Response Array নাকি Object তা যাচাই করে সেট করা
      const data = res.data.requests ? res.data.requests : Array.isArray(res.data) ? res.data : [];
      setRequests(data);
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError(err.response?.data?.message || "Could not load your active requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#2d3748", fontSize: "24px", fontWeight: "600" }}>Seeker Dashboard</h2>
          <p style={{ margin: "4px 0 0", color: "#718096", fontSize: "14px" }}>
            Manage and track your mental health support requests.
          </p>
        </div>

        <Link to="/dashboard/new-request">
          <button style={{ backgroundColor: "#2f855a", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
            + New Request
          </button>
        </Link>
      </div>

      <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "32px" }}>
        <h3 style={{ marginTop: 0, color: "#2d3748", fontSize: "18px", marginBottom: "16px" }}>Your Active Requests</h3>

        {loading ? (
          <p style={{ color: "#718096" }}>Loading requests...</p>
        ) : error ? (
          <p style={{ color: "crimson" }}>{error}</p>
        ) : requests.length === 0 ? (
          <p style={{ color: "#718096", margin: "1rem 0" }}>No active requests found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requests.map((req) => (
              <div key={req._id || req.id} style={{ padding: "16px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "#f7faf8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ fontWeight: "600", color: "#2d3748" }}>
                      {req._id ? `REQ-${req._id.slice(-5).toUpperCase()}` : req.id}
                    </span>
                    <span style={{ backgroundColor: "#e2e8f0", color: "#2d3748", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", textTransform: "capitalize" }}>
                      {req.category?.replace("_", " ") || "General"}
                    </span>
                  </div>
                  <span
                    style={{
                      backgroundColor: req.status === "closed" ? "#c6f6d5" : "#feebc8",
                      color: req.status === "closed" ? "#22543d" : "#744210",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "capitalize",
                    }}
                  >
                    {req.status || "pending"}
                  </span>
                </div>

                <p style={{ color: "#4a5568", margin: "8px 0", fontSize: "14px" }}>{req.description}</p>

                <div style={{ display: "flex", justifyContent: "space-between", color: "#718096", fontSize: "12px", marginTop: "12px", borderTop: "1px solid #edf2f7", paddingTop: "8px" }}>
                  <small>Submitted on: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "N/A"}</small>
                  <small>
                    Urgency: <strong style={{ textTransform: "capitalize" }}>{req.urgency || "low"}</strong>
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <h3 style={{ marginTop: 0, color: "#2d3748", fontSize: "18px", marginBottom: "8px" }}>Live Support Chat</h3>
        <p style={{ color: "#718096", fontSize: "14px", marginBottom: "16px" }}>
          Connect directly with an assigned volunteer or psychologist.
        </p>

        <ChatWindow currentUserId={user.id || "seeker_user"} />
      </div>
    </div>
  );
}