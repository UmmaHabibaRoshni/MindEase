import React from "react";
import { Link } from "react-router-dom";

const colors = {
  primary: "#2f855a",
  primaryLight: "#f0fff4",
  text: "#2d3748",
  muted: "#718096",
  bg: "#f7faf8",
  white: "#ffffff",
  border: "#e2e8f0",
};

export default function Home() {
  return (
    <div style={{ backgroundColor: colors.bg, minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          padding: "80px 20px",
          textAlign: "center",
          backgroundColor: colors.white,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <span
            style={{
              color: colors.primary,
              fontWeight: "600",
              fontSize: "14px",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Welcome to MindEase
          </span>
          <h1
            style={{
              fontSize: "42px",
              color: colors.text,
              margin: "16px 0",
              fontWeight: "700",
            }}
          >
            Your Safe Space for Mental Well-being
          </h1>
          <p
            style={{
              fontSize: "18px",
              color: colors.muted,
              lineHeight: "1.6",
              marginBottom: "32px",
            }}
          >
            Connect anonymously with trained volunteers, certified psychologists, and supportive communities. Get the care and guidance you deserve today.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <Link
              to="/register"
              style={{
                backgroundColor: colors.primary,
                color: colors.white,
                padding: "14px 28px",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Get Started 
            </Link>
            <Link
              to="/login"
              style={{
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.white,
                color: colors.text,
                padding: "14px 28px",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <div style={{ maxWidth: "1100px", margin: "60px auto", padding: "0 20px" }}>
        <h2
          style={{
            fontSize: "28px",
            color: colors.text,
            textAlign: "center",
            marginBottom: "40px",
            fontWeight: "600",
          }}
        >
          How MindEase Helps You
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "28px",
          }}
        >
          <div
            style={{
              background: colors.white,
              padding: "28px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ fontSize: "20px", color: colors.primary, marginBottom: "12px" }}>
              🔒 Anonymous & Secure
            </h3>
            <p style={{ color: colors.muted, fontSize: "15px", lineHeight: "1.6" }}>
              Your privacy is our priority. Talk freely without revealing your identity or worrying about data safety.
            </p>
          </div>

          <div
            style={{
              background: colors.white,
              padding: "28px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ fontSize: "20px", color: colors.primary, marginBottom: "12px" }}>
              👨‍⚕️ Professional Support
            </h3>
            <p style={{ color: colors.muted, fontSize: "15px", lineHeight: "1.6" }}>
              Connect with certified psychologists and trained volunteers whenever you need professional guidance.
            </p>
          </div>

          <div
            style={{
              background: colors.white,
              padding: "28px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3 style={{ fontSize: "20px", color: colors.primary, marginBottom: "12px" }}>
              🤝 NGO & Community
            </h3>
            <p style={{ color: colors.muted, fontSize: "15px", lineHeight: "1.6" }}>
              Access emergency resources and get referred to trusted NGOs for comprehensive mental assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}