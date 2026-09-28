
const colors = {
  primary: "#2f855a",
  primaryLight: "#c6f6d5",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
};

export default function DashboardPlaceholder({ role, greeting, plannedFeatures = [], note }) {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ borderLeft: `4px solid ${colors.primary}`, paddingLeft: 16, marginBottom: 32 }}>
          <p style={{ margin: 0, color: colors.primary, fontWeight: 600, fontSize: 14 }}>
            {role} dashboard
          </p>
          <h1 style={{ margin: "4px 0 8px", color: colors.text, fontSize: 28, lineHeight: 1.25 }}>
            {greeting}
          </h1>
          <p style={{ margin: 0, color: colors.muted, fontSize: 16, lineHeight: 1.5 }}>
            This page is a placeholder. The features below are planned for later sprints.
          </p>
        </header>

        {note && (
          <div
            style={{
              background: colors.primaryLight,
              border: `1px solid ${colors.primary}`,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
              color: colors.text,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            {note}
          </div>
        )}

        <section
          style={{
            background: colors.white,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: "20px 24px",
          }}
        >
          <h2 style={{ margin: "0 0 12px", color: colors.text, fontSize: 18 }}>Coming soon</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: colors.text, fontSize: 15, lineHeight: 1.8 }}>
            {plannedFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}