import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminSummary, readError } from "../../api/adminApi";
import { CATEGORIES } from "../../components/requestOptions";

// T16.7 (BL-16) - admin dashboard stats page, replacing the placeholder.
//
// All numbers come from GET /api/admin/summary (T16.3). That API returns every
// bucket from the schema enums, even when the count is 0, so this page can
// draw a fixed set of rows without guessing which keys exist. Any new bucket
// (for example 'suspended' once T16.1 lands) shows up here with no edit.
//
// Inline styles, same palette as the other admin pages (ManageUsers.jsx).
// data-testid values are there for the unit tests (T16.8) and Selenium (T16.13).

const colors = {
  primary: "#2f855a",
  primaryLight: "#c6f6d5",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
  error: "#c53030",
  errorBg: "#fff5f5",
  warn: "#b7791f",
};

const styles = {
  page: { padding: "24px", backgroundColor: colors.bg, minHeight: "100%" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  },
  h1: { margin: "0 0 4px", fontSize: "24px", fontWeight: 600, color: colors.text },
  sub: { margin: 0, fontSize: "14px", color: colors.muted },
  refreshBtn: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: `1px solid ${colors.primary}`,
    backgroundColor: colors.white,
    color: colors.primary,
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },
  card: {
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    padding: "16px",
  },
  cardLabel: { margin: 0, fontSize: "13px", color: colors.muted },
  cardValue: { margin: "6px 0 4px", fontSize: "28px", fontWeight: 700, color: colors.text },
  cardHint: { margin: 0, fontSize: "13px", color: colors.muted },
  panels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  panel: {
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    padding: "16px",
  },
  h2: { margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: colors.text },
  row: { marginBottom: "10px" },
  rowTop: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: colors.text },
  barTrack: {
    height: "6px",
    backgroundColor: colors.border,
    borderRadius: "3px",
    marginTop: "4px",
    overflow: "hidden",
  },
  links: { display: "flex", gap: "12px", flexWrap: "wrap" },
  link: {
    padding: "8px 14px",
    borderRadius: "6px",
    backgroundColor: colors.primary,
    color: colors.white,
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
  },
  error: {
    padding: "12px",
    borderRadius: "6px",
    backgroundColor: colors.errorBg,
    color: colors.error,
    fontSize: "14px",
    marginBottom: "16px",
  },
};

// "in_progress" -> "In progress", "No-Show" stays readable.
const humanize = (key) => {
  const text = String(key).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Roles: only "ngo" needs a special case.
const roleLabel = (key) => (key === "ngo" ? "NGO" : humanize(key));

// Request categories use the same labels as the crisis request form.
const categoryLabel = (key) => CATEGORIES.find((c) => c.value === key)?.label || humanize(key);

const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

// Safe read of a nested count, so a missing bucket shows 0 instead of crashing.
const countOf = (obj, key) => (obj && typeof obj[key] === "number" ? obj[key] : 0);

function StatCard({ id, label, value, hint, linkTo, linkText }) {
  return (
    <div style={styles.card} data-testid={`stat-${id}`}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
      {hint && <p style={styles.cardHint}>{hint}</p>}
      {linkTo && (
        <Link to={linkTo} style={{ fontSize: "13px", color: colors.primary, fontWeight: 600 }}>
          {linkText}
        </Link>
      )}
    </div>
  );
}

// One panel: a title and one row per bucket, with a bar showing its share.
function Breakdown({ id, title, counts = {}, labelFor = humanize }) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <section style={styles.panel} data-testid={`breakdown-${id}`}>
      <h2 style={styles.h2}>{title}</h2>
      {entries.length === 0 && <p style={styles.cardHint}>No data yet.</p>}
      {entries.map(([key, n]) => {
        const percent = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div key={key} style={styles.row} data-testid={`breakdown-${id}-${key}`}>
            <div style={styles.rowTop}>
              <span>{labelFor(key)}</span>
              <strong>{n}</strong>
            </div>
            <div style={styles.barTrack}>
              <div
                style={{ width: `${percent}%`, height: "100%", backgroundColor: colors.primary }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      return await getAdminSummary();
    } catch (err) {
      setError(readError(err, "Could not load the dashboard numbers."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // First load. The `active` flag stops a late response from updating the page
  // after the admin has already navigated away.
  useEffect(() => {
    let active = true;
    (async () => {
      const data = await load();
      if (active && data) setSummary(data);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = async () => {
    const data = await load();
    if (data) setSummary(data);
  };

  const users = summary?.users || {};
  const requests = summary?.requests || {};
  const workshops = summary?.workshops || {};
  const referrals = summary?.referrals || {};

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Admin Dashboard</h1>
          <p style={styles.sub}>
            Platform overview
            {summary?.generatedAt && ` · Updated at ${formatTime(summary.generatedAt)}`}
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      )}

      {loading && !summary && <p style={styles.sub}>Loading dashboard...</p>}

      {summary && (
        <>
          <div style={styles.cards}>
            <StatCard id="users" label="Total users" value={users.total ?? 0} />
            <StatCard
              id="pending-approvals"
              label="Pending approvals"
              value={countOf(users.byStatus, "pending")}
              linkTo="/dashboard/verifications"
              linkText="Review →"
            />
            <StatCard
              id="requests"
              label="Crisis requests"
              value={requests.total ?? 0}
              hint={`${countOf(requests.byStatus, "pending")} waiting for a volunteer`}
            />
            <StatCard
              id="referrals"
              label="NGO referrals"
              value={referrals.total ?? 0}
              hint={`${countOf(referrals.byStatus, "pending")} not answered yet`}
            />
            <StatCard
              id="workshops"
              label="Workshops"
              value={workshops.total ?? 0}
              hint={`${countOf(workshops.byStatus, "Scheduled")} scheduled`}
            />
            <StatCard
              id="enrollments"
              label="Active enrollments"
              value={workshops.activeEnrollments ?? 0}
            />
          </div>

          <div style={styles.panels}>
            <Breakdown
              id="users-role"
              title="Users by role"
              counts={users.byRole}
              labelFor={roleLabel}
            />
            <Breakdown id="users-status" title="Users by status" counts={users.byStatus} />
            <Breakdown id="requests-status" title="Requests by status" counts={requests.byStatus} />
            <Breakdown
              id="requests-category"
              title="Requests by category"
              counts={requests.byCategory}
              labelFor={categoryLabel}
            />
            <Breakdown id="referrals-status" title="Referrals by status" counts={referrals.byStatus} />
            <Breakdown id="workshops-status" title="Workshops by status" counts={workshops.byStatus} />
          </div>
        </>
      )}

      <h2 style={styles.h2}>Quick links</h2>
      <div style={styles.links}>
        <Link to="/dashboard/verifications" style={styles.link}>
          Verify accounts
        </Link>
        <Link to="/dashboard/users" style={styles.link}>
          Manage users
        </Link>
        <Link to="/dashboard/resources" style={styles.link}>
          Manage resources
        </Link>
      </div>
    </div>
  );
}
