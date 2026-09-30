import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CATEGORIES, URGENCY_LEVELS } from "../../components/requestOptions";

export default function CrisisRequestForm() {
  const navigate = useNavigate();

  // formData State Definition
  const [formData, setFormData] = useState({
    category: CATEGORIES[0]?.value || "mental_health",
    urgency: URGENCY_LEVELS[0]?.value || "low",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/requests", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate("/dashboard/seeker");
    } catch (err) {
      console.error("Error submitting crisis request:", err);
      setError(
        err.response?.data?.message || "Failed to submit request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "2rem auto",
        padding: "24px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
      }}
    >
      <h2 style={{ color: "#2d3748", marginBottom: "8px" }}>Request Crisis Support</h2>
      <p style={{ color: "#718096", fontSize: "14px", marginBottom: "24px" }}>
        Fill out the form below to get help from our support team.
      </p>

      {error && (
        <div
          style={{
            color: "crimson",
            backgroundColor: "#fff5f5",
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", color: "#4a5568", marginBottom: "6px" }}>
            Category
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e0" }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "600", color: "#4a5568", marginBottom: "6px" }}>
            Urgency Level
          </label>
          <select
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e0" }}
          >
            {URGENCY_LEVELS.map((urg) => (
              <option key={urg.value} value={urg.value}>
                {urg.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontWeight: "600", color: "#4a5568", marginBottom: "6px" }}>
            Description / Notes (At least 10 characters)
          </label>
          <textarea
            name="description"
            rows="4"
            required
            minLength={10}
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what you are currently going through..."
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e0", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => navigate("/dashboard/seeker")}
            style={{ padding: "10px 18px", borderRadius: "6px", border: "1px solid #cbd5e0", backgroundColor: "#fff", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 18px", borderRadius: "6px", border: "none", backgroundColor: "#2f855a", color: "#fff", fontWeight: "600", cursor: "pointer" }}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}