import React from "react";
import { Link } from "react-router-dom";

// Shared frame for the three payment result pages (T17.9).
//
// These pages are the first thing a seeker sees after SSLCommerz sends their
// browser back, so each one says plainly what happened, whether a seat was
// taken, and what to do next.

const TONES = {
  success: { bar: "#2f855a", bg: "#f0fff4", border: "#c6f6d5", heading: "#22543d" },
  failed: { bar: "#9b2c2c", bg: "#fff5f5", border: "#fed7d7", heading: "#822727" },
  cancelled: { bar: "#975a16", bg: "#fffaf0", border: "#feebc8", heading: "#7b341e" },
};

const linkButton = {
  display: "inline-block",
  padding: "10px 20px",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "14px",
  textDecoration: "none",
};

export default function ResultCard({ tone, title, children, actions = [] }) {
  const colors = TONES[tone] || TONES.failed;

  return (
    <div style={{ padding: "48px 24px", maxWidth: "640px", margin: "0 auto" }}>
      <div
        role="status"
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          borderTop: `4px solid ${colors.bar}`,
          borderRadius: "8px",
          padding: "28px",
        }}
      >
        <h1 style={{ margin: "0 0 12px", color: colors.heading, fontSize: "22px", fontWeight: "600" }}>
          {title}
        </h1>
        <div style={{ color: "#4a5568", fontSize: "15px", lineHeight: "1.6" }}>{children}</div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" }}>
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              style={{
                ...linkButton,
                backgroundColor: a.primary ? colors.bar : "#fff",
                color: a.primary ? "#fff" : "#2d3748",
                border: a.primary ? "none" : "1px solid #cbd5e0",
              }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
