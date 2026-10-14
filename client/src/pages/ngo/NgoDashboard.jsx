import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../../components/common/StatusBadge";
import { getMyReferrals, readError } from "../../api/ngoApi";

const STATUS_FILTERS = ["all", "pending", "in_progress", "resolved", "closed"];

const label = (s) => (s === "all" ? "All" : s.replace("_", " "));

export default function NgoDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const list = await getMyReferrals();
        if (active) setReferrals(list);
      } catch (err) {
        if (active) setError(readError(err, "Could not load referrals."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const visible =
    filter === "all" ? referrals : referrals.filter((r) => r.status === filter);

  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ color: "#2d3748", marginBottom: "1rem" }}>Referred Cases</h2>

      {error && (
        <p
          role="alert"
          style={{
            color: "crimson",
            backgroundColor: "#fff5f5",
            padding: "8px",
            borderRadius: "4px",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="status-filter"
          style={{ fontSize: "14px", fontWeight: 600, color: "#4a5568" }}
        >
          Filter by status:{" "}
        </label>
        <select
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "4px",
            border: "1px solid #cbd5e0",
            marginLeft: "8px",
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </div>

      {!error && visible.length === 0 ? (
        <p style={{ color: "#718096" }}>
          {referrals.length === 0
            ? "No referred cases yet."
            : "No referrals with this status."}
        </p>
      ) : (
        visible.map((r) => (
          <div
            key={r._id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "1.2rem",
              marginBottom: "1rem",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <p>
              <strong>Category:</strong> {r.request?.category || "N/A"}
            </p>
            <p>
              <strong>Urgency:</strong> {r.request?.urgency || "N/A"}
            </p>
            <p style={{ color: "#4a5568", margin: "8px 0" }}>
              {r.request?.description}
            </p>
            {r.createdAt && (
              <p style={{ color: "#718096", fontSize: "13px" }}>
                Referred on {new Date(r.createdAt).toLocaleDateString()}
              </p>
            )}
            <div style={{ marginTop: "12px" }}>
              <StatusBadge status={r.status} />
            </div>
            <Link
              to={`/dashboard/ngo/referrals/${r._id}`}
              style={{
                display: "inline-block",
                marginTop: "12px",
                color: "#2b6cb0",
                fontSize: "14px",
              }}
            >
              Open →
            </Link>
          </div>
        ))
      )}
    </div>
  );
}