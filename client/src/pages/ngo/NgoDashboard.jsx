//const REFERRAL_STATUSES = ["pending", "in_progress", "resolved", "closed"];
import { useEffect, useState } from "react";
import axios from "axios";
import { REFERRAL_STATUSES } from "../../components/requestOptions";
import StatusBadge from "../../components/common/StatusBadge";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const statusValue = (s) => (typeof s === "string" ? s : s.value);

export default function NgoDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await axios.get("/api/referrals/mine", authHeader());
      setReferrals(res.data.referrals);
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

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h2>Referred cases</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {referrals.length === 0 && <p>No referred cases yet.</p>}

      {referrals.map((r) => (
        <div
          key={r._id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <p><strong>Category:</strong> {r.request?.category}</p>
          <p><strong>Urgency:</strong> {r.request?.urgency}</p>
          <p>{r.request?.description}</p>
          <p><StatusBadge status={r.status} /></p>

          <label>Update status: </label>
          <select value={r.status} onChange={(e) => updateStatus(r._id, e.target.value)}>
            {REFERRAL_STATUSES.map((s) => (
              <option key={statusValue(s)} value={statusValue(s)}>
                {statusValue(s).replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}