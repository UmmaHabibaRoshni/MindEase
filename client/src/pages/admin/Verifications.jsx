import { useEffect, useState } from "react";
import { getPendingUsers, approveUser, rejectUser, readError } from "../../api/adminApi";

// T8.7 / T8.8 - admin account verification queue (BL-8)

const colors = {
  primary: "#2f855a",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
  error: "#c53030",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";

export default function Verifications() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // id of the row currently being approved/rejected, so only that row locks
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  // The state updates all happen after an await, so the effect never triggers a
  // cascading render (react-hooks/set-state-in-effect).
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await getPendingUsers();
        if (active) setUsers(rows);
      } catch (err) {
        if (active) setError(readError(err, "Could not load pending accounts."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Drop the row locally instead of refetching - it is no longer pending.
  const removeRow = (id, message) => {
    setUsers((current) => current.filter((u) => u._id !== id));
    setNotice(message);
    setError("");
  };

  const handleApprove = async (user) => {
    setBusyId(user._id);
    try {
      await approveUser(user._id);
      removeRow(user._id, `${user.name} was approved.`);
    } catch (err) {
      setError(readError(err, "Could not approve this account."));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (user) => {
    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setBusyId(user._id);
    try {
      await rejectUser(user._id, reason);
      removeRow(user._id, `${user.name} was rejected.`);
      setRejectingId(null);
      setReason("");
    } catch (err) {
      setError(readError(err, "Could not reject this account."));
    } finally {
      setBusyId(null);
    }
  };

  const startReject = (id) => {
    setRejectingId(id);
    setReason("");
    setError("");
  };

  return (
    <div style={{ padding: 32, background: colors.bg, minHeight: "100%" }}>
      <h1 style={{ margin: 0, fontSize: 24, color: colors.text }}>Account verifications</h1>
      <p style={{ marginTop: 6, color: colors.muted, fontSize: 14 }}>
        Volunteers, psychologists, NGOs and facilitators stay pending until an admin reviews them.
      </p>

      {error && (
        <div data-testid="verifications-error" style={banner(colors.error, "#fff5f5")}>
          {error}
        </div>
      )}
      {notice && (
        <div data-testid="verifications-notice" style={banner(colors.primary, "#f0fff4")}>
          {notice}
        </div>
      )}

      {loading ? (
        <p data-testid="verifications-loading" style={{ color: colors.muted }}>
          Loading pending accounts...
        </p>
      ) : users.length === 0 ? (
        <p data-testid="verifications-empty" style={{ color: colors.muted }}>
          No pending accounts to review.
        </p>
      ) : (
        <table
          data-testid="verifications-table"
          style={{
            width: "100%",
            marginTop: 20,
            borderCollapse: "collapse",
            background: colors.white,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              {["Name", "Email", "Role", "Requested", "Actions"].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} data-testid={`pending-row-${user._id}`}>
                <td style={tdStyle}>{user.name}</td>
                <td style={tdStyle}>{user.email}</td>
                <td style={{ ...tdStyle, textTransform: "capitalize" }}>{user.role}</td>
                <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                <td style={tdStyle}>
                  {rejectingId === user._id ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        aria-label="Rejection reason"
                        placeholder="Reason for rejection"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{
                          padding: "6px 8px",
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      />
                      <button
                        onClick={() => handleReject(user)}
                        disabled={busyId === user._id}
                        style={btn(colors.error)}
                      >
                        Confirm
                      </button>
                      <button onClick={() => setRejectingId(null)} style={btn(colors.muted)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleApprove(user)}
                        disabled={busyId === user._id}
                        style={btn(colors.primary)}
                      >
                        {busyId === user._id ? "Working..." : "Approve"}
                      </button>
                      <button onClick={() => startReject(user._id)} style={btn(colors.error)}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: `1px solid ${colors.border}`,
  color: colors.muted,
  fontWeight: 600,
};

const tdStyle = {
  padding: "12px 14px",
  borderBottom: `1px solid ${colors.border}`,
  color: colors.text,
};

function banner(border, background) {
  return {
    marginTop: 16,
    padding: "10px 14px",
    border: `1px solid ${border}`,
    background,
    borderRadius: 6,
    color: border,
    fontSize: 14,
  };
}

function btn(background) {
  return {
    padding: "6px 12px",
    background,
    color: colors.white,
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}
