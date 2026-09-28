import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const colors = {
  primary: "#2f855a",
  primaryLight: "#c6f6d5",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
  error: "#c53030",
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // ADJUST: endpoint path if your authRoutes.js uses something else
      const res = await axios.post("/api/auth/login", form);

      // ADJUST: field names if authController.js returns a different shape
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: "32px 28px",
        }}
      >
        <p style={{ margin: 0, color: colors.primary, fontWeight: 600, fontSize: 14 }}>
          MindEase
        </p>
        <h1 style={{ margin: "4px 0 24px", color: colors.text, fontSize: 24 }}>
          Welcome back
        </h1>

        {error && (
          <div
            style={{
              background: "#fff5f5",
              border: `1px solid ${colors.error}`,
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
              color: colors.error,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={loading} style={buttonStyle(loading)}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: colors.muted, textAlign: "center" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: colors.primary, fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 16,
  color: colors.text,
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  fontSize: 15,
  color: colors.text,
  boxSizing: "border-box",
};

function buttonStyle(loading) {
  return {
    width: "100%",
    padding: "12px",
    marginTop: 4,
    background: loading ? colors.primaryLight : colors.primary,
    color: loading ? colors.primary : colors.white,
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 600,
    cursor: loading ? "default" : "pointer",
  };
}