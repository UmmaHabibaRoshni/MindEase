import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/common/StatusBadge";
import {
  getReferral,
  updateReferralStatus,
  readError,
} from "../../api/ngoApi";

// Same list as REFERRAL_STATUSES in client/src/constants/requestOptions.js
const STATUSES = ["pending", "in_progress", "resolved", "closed"];
// Same limit as NOTE_MAX in server/models/Referral.js
const NOTE_MAX = 1000;

const label = (s) => s.replace("_", " ");

export default function ReferralDetail() {
  const { id } = useParams();

  const [referral, setReferral] = useState(null);
  const [status, setStatus] = useState("pending");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await getReferral(id);
        if (!active) return;
        setReferral(data);
        setStatus(data.status);
        setNote(data.note || "");
      } catch (err) {
        if (active) setError(readError(err, "Could not load this referral."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const unchanged =
    referral && status === referral.status && note.trim() === (referral.note || "");

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await updateReferralStatus(id, { status, note });
      setReferral(updated);
      setStatus(updated.status);
      setNote(updated.note || "");
      setSuccess("Referral updated.");
    } catch (err) {
      setError(readError(err, "Could not update this referral."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <Link to="/dashboard/ngo" style={{ color: "#2b6cb0", fontSize: "14px" }}>
        ← Back to referred cases
      </Link>

      <h2 style={{ color: "#2d3748", margin: "1rem 0" }}>Referral</h2>

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

      {referral && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "1.2rem",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <p>
            <strong>Category:</strong> {referral.request?.category || "N/A"}
          </p>
          <p>
            <strong>Urgency:</strong> {referral.request?.urgency || "N/A"}
          </p>
          <p style={{ color: "#4a5568", margin: "8px 0" }}>
            {referral.request?.description}
          </p>
          {referral.createdAt && (
            <p style={{ color: "#718096", fontSize: "13px" }}>
              Referred on {new Date(referral.createdAt).toLocaleDateString()}
            </p>
          )}
          {referral.respondedAt && (
            <p style={{ color: "#718096", fontSize: "13px" }}>
              First response on {new Date(referral.respondedAt).toLocaleDateString()}
            </p>
          )}

          <div style={{ margin: "12px 0" }}>
            <StatusBadge status={referral.status} />
          </div>

          <label
            htmlFor="referral-status"
            style={{ fontSize: "14px", fontWeight: 600, color: "#4a5568" }}
          >
            Update status
          </label>
          <select
            id="referral-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving}
            style={{
              display: "block",
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #cbd5e0",
              margin: "4px 0 12px",
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>

          <label
            htmlFor="referral-note"
            style={{ fontSize: "14px", fontWeight: 600, color: "#4a5568" }}
          >
            Note (optional)
          </label>
          <textarea
            id="referral-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={4}
            disabled={saving}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #cbd5e0",
              margin: "4px 0",
            }}
          />
          <p style={{ color: "#718096", fontSize: "12px", margin: "0 0 12px" }}>
            {note.length}/{NOTE_MAX}
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || unchanged}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: saving || unchanged ? "#a0aec0" : "#2b6cb0",
              color: "#ffffff",
              cursor: saving || unchanged ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {success && (
            <p role="status" style={{ color: "#276749", marginTop: "12px" }}>
              {success}
            </p>
          )}
        </div>
      )}
    </div>
  );
}