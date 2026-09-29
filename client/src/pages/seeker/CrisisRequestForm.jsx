import { useState } from "react";
import axios from "axios";
import { CATEGORIES, URGENCY_LEVELS } from "../../components/requestOptions";

const toOption = (o) =>
  typeof o === "string"
    ? { value: o, label: o.replace(/_/g, " ") }
    : { value: o.value, label: o.label || o.value };

const fieldStyle = {
  width: "100%",
  padding: "0.6rem",
  marginBottom: "1rem",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: "1rem",
  boxSizing: "border-box",
};

const labelStyle = { display: "block", fontWeight: 600, marginBottom: 4 };

export default function CrisisRequestForm() {
  const [form, setForm] = useState({ category: "", description: "", urgency: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.description.trim().length < 10) {
      return setError("Description must be at least 10 characters.");
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/requests", form, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setSuccess(res.data.message || "Request submitted");
      setForm({ category: "", description: "", urgency: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Submit a crisis request</h2>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Category</label>
        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          required
          style={fieldStyle}
        >
          <option value="">Select category</option>
          {CATEGORIES.map(toOption).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label style={labelStyle}>Urgency</label>
        <select
          name="urgency"
          value={form.urgency}
          onChange={handleChange}
          required
          style={fieldStyle}
        >
          <option value="">Select urgency</option>
          {URGENCY_LEVELS.map(toOption).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label style={labelStyle}>Describe your situation</label>
        <textarea
          name="description"
          rows={5}
          maxLength={2000}
          value={form.description}
          onChange={handleChange}
          required
          style={fieldStyle}
        />

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.7rem",
            background: "#2e8b57",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          {loading ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </div>
  );
}