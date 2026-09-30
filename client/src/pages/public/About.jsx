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

export default function About() {
  return (
    <div style={{ backgroundColor: colors.bg, minHeight: "100vh", paddingBottom: "60px" }}>
      
      {/* Header Banner */}
      <section
        style={{
          padding: "60px 20px",
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
            About MindEase
          </span>
          <h1
            style={{
              fontSize: "36px",
              color: colors.text,
              margin: "12px 0",
              fontWeight: "700",
            }}
          >
            Empowering Mental Health & Support
          </h1>
          <p style={{ fontSize: "16px", color: colors.muted, lineHeight: "1.6" }}>
            MindEase is a safe, inclusive, and non-judgmental digital platform designed to bridge the gap between mental health support and those in need.
          </p>
        </div>
      </section>

      {/* Main Content Container */}
      <div style={{ maxWidth: "900px", margin: "40px auto", padding: "0 20px" }}>
        
        {/* Mission & Vision */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              backgroundColor: colors.white,
              padding: "28px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h2 style={{ fontSize: "20px", color: colors.primary, marginBottom: "12px", fontWeight: "600" }}>
              🎯 Our Mission
            </h2>
            <p style={{ color: colors.muted, fontSize: "15px", lineHeight: "1.6" }}>
              To provide accessible, anonymous, and reliable mental health support by connecting individuals with empathetic volunteers, certified professionals, and community resources.
            </p>
          </div>

          <div
            style={{
              backgroundColor: colors.white,
              padding: "28px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h2 style={{ fontSize: "20px", color: colors.primary, marginBottom: "12px", fontWeight: "600" }}>
              👁️ Our Vision
            </h2>
            <p style={{ color: colors.muted, fontSize: "15px", lineHeight: "1.6" }}>
              To foster a world where seeking mental health support is free of stigma, easily accessible to all, and integrated seamlessly into daily life.
            </p>
          </div>
        </div>

        {/* Core Values */}
        <section
          style={{
            backgroundColor: colors.white,
            padding: "32px",
            borderRadius: "8px",
            border: `1px solid ${colors.border}`,
            marginBottom: "40px",
          }}
        >
          <h2 style={{ fontSize: "22px", color: colors.text, marginBottom: "20px", fontWeight: "600" }}>
            Our Core Values
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", color: colors.primary, fontWeight: "600" }}>1. Confidentiality & Anonymity</h3>
              <p style={{ color: colors.muted, fontSize: "14px", marginTop: "4px" }}>
                We protect your identity and ensure your interactions remain private and safe at all times.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: "16px", color: colors.primary, fontWeight: "600" }}>2. Empathy & Compassion</h3>
              <p style={{ color: colors.muted, fontSize: "14px", marginTop: "4px" }}>
                Every voice matters. We offer support without judgment, stigma, or prejudice.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: "16px", color: colors.primary, fontWeight: "600" }}>3. Professional Integrity</h3>
              <p style={{ color: colors.muted, fontSize: "14px", marginTop: "4px" }}>
                We collaborate with verified psychologists, trained facilitators, and recognized NGOs to provide trusted guidance.
              </p>
            </div>
          </div>
        </section>

        {/* Emergency Disclaimer */}
        <section
          style={{
            backgroundColor: "#fff5f5",
            border: "1px solid #feb2b2",
            padding: "24px",
            borderRadius: "8px",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <h3 style={{ color: "#c53030", fontSize: "18px", marginBottom: "8px", fontWeight: "600" }}>
            ⚠️ Crisis Disclaimer
          </h3>
          <p style={{ color: "#742a2a", fontSize: "14px", lineHeight: "1.5" }}>
            MindEase is designed for counseling, peer support, and resource sharing. If you or someone you know is in immediate danger or facing a medical crisis, please contact emergency medical services or national hotlines immediately.
          </p>
        </section>

        {/* Action Button */}
        <div style={{ textAlign: "center" }}>
          <Link
            to="/register"
            style={{
              backgroundColor: colors.primary,
              color: colors.white,
              padding: "12px 28px",
              borderRadius: "6px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Join MindEase Today
          </Link>
        </div>

      </div>
    </div>
  );
}