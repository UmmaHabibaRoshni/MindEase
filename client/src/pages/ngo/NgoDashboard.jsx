import { useEffect, useState } from "react";
import axios from "axios";
import { REFERRAL_STATUSES } from "../../components/requestOptions";
import StatusBadge from "../../components/common/StatusBadge";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export default function NgoDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Object values array-তে রূপান্তর (ড্রপডাউনের জন্য)
  const statusList = typeof REFERRAL_STATUSES === "object" && !Array.isArray(REFERRAL_STATUSES)
    ? Object.values(REFERRAL_STATUSES)
    : REFERRAL_STATUSES;

  const load = async () => {
    try {
      const res = await axios.get("/api/referrals/mine", authHeader());
      setReferrals(res.data.referrals || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load referrals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    setError("");
    try {
      await axios.patch(`/api/referrals/${id}/status`, { status }, authHeader());
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update status.");
    }
  };

  if (loading) return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ color: "#2d3748", marginBottom: "1rem" }}>Referred Cases</h2>
      {error && <p style={{ color: "crimson", backgroundColor: "#fff5f5", padding: "8px", borderRadius: "4px" }}>{error}</p>}
      
      {referrals.length === 0 ? (
        <p style={{ color: "#718096" }}>No referred cases yet.</p>
      ) : (
        referrals.map((r) => (
          <div
            key={r._id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "1.2rem",
              marginBottom: "1rem",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <p><strong>Category:</strong> {r.request?.category || "N/A"}</p>
            <p><strong>Urgency:</strong> {r.request?.urgency || "N/A"}</p>
            <p style={{ color: "#4a5568", margin: "8px 0" }}>{r.request?.description}</p>
            
            <div style={{ marginBottom: "12px" }}>
              <StatusBadge status={r.status} />
            </div>

            <label style={{ fontSize: "14px", fontWeight: "600", color: "#4a5568" }}>
              Update status:{" "}
            </label>
            <select
              value={r.status}
              onChange={(e) => updateStatus(r._id, e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #cbd5e0",
                marginLeft: "8px"
              }}
            >
              {statusList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ))
      )}
    </div>
  );
}