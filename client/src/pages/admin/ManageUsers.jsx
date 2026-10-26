import { useCallback, useEffect, useState } from "react";
import { getUsers, suspendUser, reactivateUser, readError } from "../../api/adminApi";

// T16.9 (BL-16) - admin user management: list, filter, suspend, reactivate.
//
// Tailwind is not installed here, so the styles are inline like the other
// admin pages.
//
// 'suspended' arrives on the User model in T16.1. Until then the filter still
// offers it and the list still renders it correctly - there just are not any.

const ROLES = ["seeker", "volunteer", "psychologist", "ngo", "facilitator", "admin"];
const STATUSES = ["pending", "approved", "rejected", "suspended"];

const colors = {
  primary: "#2f855a",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
  error: "#c53030",
  warn: "#b7791f",
};

const statusColor = {
  approved: colors.primary,
  pending: colors.warn,
  rejected: colors.error,
  suspended: colors.error,
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";

// Who is signed in. T16.5 does not mark the admin's own row, and the server
// refuses a self-suspend with a 400, so the row is recognised here instead of
// offering a button that can only fail. Login stores the id as `id`.
function signedInId() {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user ? String(user.id || user._id || "") : "";
  } catch {
    return "";
  }
}

const styles = {
  page: { padding: "24px", backgroundColor: colors.bg, minHeight: "100%" },
  h1: { margin: "0 0 4px", fontSize: "24px", fontWeight: 600, color: colors.text },
  sub: { margin: "0 0 20px", fontSize: "14px", color: colors.muted },
  filters: { display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" },
  input: {
    padding: "8px 10px",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    fontSize: "14px",
    minWidth: "160px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: colors.muted,
    borderBottom: `1px solid ${colors.border}`,
  },
  td: { padding: "10px 12px", fontSize: "14px", borderBottom: `1px solid ${colors.border}` },
  btn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    color: colors.white,
  },
  message: { padding: "10px 12px", borderRadius: "6px", marginBottom: "12px", fontSize: "14px" },
};

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Which row is being suspended, and the reason typed for it. An admin should
  // never be able to suspend someone without saying why - the account holder is
  // told the reason, the same as a rejection.
  const [suspendingId, setSuspendingId] = useState(null);
  const [reason, setReason] = useState("");

  // Read once: it cannot change while the page is open.
  const [myId] = useState(signedInId);

  const load = useCallback(async (filters) => {
    setLoading(true);
    setError("");
    try {
      return await getUsers(filters);
    } catch (err) {
      setError(readError(err, "Could not load the user list."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // One effect for the first load and every filter change. The `active` flag
  // means a slow response for an old filter cannot overwrite a newer one.
  useEffect(() => {
    let active = true;

    (async () => {
      const rows = await load({ role, status, q });
      if (active && rows) setUsers(rows);
    })();

    return () => {
      active = false;
    };
  }, [load, role, status, q]);

  const applyChange = async (id, action, successText) => {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const updated = await action();
      // Patch the row in place rather than refetching: the admin keeps their
      // filters, their scroll position and their place in the list.
      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, ...(updated || {}), _id: id } : u))
      );
      setNotice(successText);
      setSuspendingId(null);
      setReason("");
    } catch (err) {
      setError(readError(err, "That did not work. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const onSuspend = (user) =>
    applyChange(user._id, () => suspendUser(user._id, reason), `${user.name} is suspended.`);

  const onReactivate = (user) =>
    applyChange(user._id, () => reactivateUser(user._id), `${user.name} is active again.`);

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Manage users</h1>
      <p style={styles.sub}>
        Everyone on MindEase. Suspending an account blocks the person from logging in.
      </p>

      {notice && (
        <p
          style={{ ...styles.message, backgroundColor: "#f0fff4", color: colors.primary }}
          role="status"
          data-testid="users-notice"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          style={{ ...styles.message, backgroundColor: "#fff5f5", color: colors.error }}
          role="alert"
          data-testid="users-error"
        >
          {error}
        </p>
      )}

      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Search name or email"
          aria-label="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="users-search"
        />
        <select
          style={styles.input}
          aria-label="Filter by role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          data-testid="users-role"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          style={styles.input}
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="users-status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <p data-testid="users-loading">Loading users...</p>}

      {!loading && users.length === 0 && (
        <p style={{ color: colors.muted }} data-testid="users-empty">
          No users match these filters.
        </p>
      )}

      {!loading && users.length > 0 && (
        <table style={styles.table} data-testid="users-table">
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const suspended = user.status === "suspended";
              const busy = busyId === user._id;
              // `isSelf` if the API ever sends it, otherwise worked out here.
              const isSelf = user.isSelf || String(user._id) === myId;

              return (
                <tr key={user._id} data-testid={`users-row-${user._id}`}>
                  <td style={styles.td}>{user.name}</td>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>{user.role}</td>
                  <td style={{ ...styles.td, color: statusColor[user.status] || colors.text }}>
                    {user.status}
                  </td>
                  <td style={styles.td}>{formatDate(user.createdAt)}</td>
                  <td style={styles.td}>
                    {/* An admin suspending themselves would lock the last admin
                        out of the system, so the button is not offered. */}
                    {isSelf ? (
                      <span style={{ color: colors.muted, fontSize: "13px" }}>This is you</span>
                    ) : suspended ? (
                      <button
                        type="button"
                        style={{ ...styles.btn, backgroundColor: colors.primary }}
                        disabled={busy}
                        onClick={() => onReactivate(user)}
                        data-testid={`users-reactivate-${user._id}`}
                      >
                        {busy ? "Working..." : "Reactivate"}
                      </button>
                    ) : suspendingId === user._id ? (
                      <span style={{ display: "flex", gap: "8px" }}>
                        <input
                          style={{ ...styles.input, minWidth: "140px" }}
                          placeholder="Reason"
                          aria-label={`Reason for suspending ${user.name}`}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          data-testid={`users-reason-${user._id}`}
                        />
                        <button
                          type="button"
                          style={{ ...styles.btn, backgroundColor: colors.error }}
                          disabled={busy || !reason.trim()}
                          onClick={() => onSuspend(user)}
                          data-testid={`users-confirm-${user._id}`}
                        >
                          {busy ? "Working..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btn, backgroundColor: colors.muted }}
                          onClick={() => {
                            setSuspendingId(null);
                            setReason("");
                          }}
                          data-testid={`users-cancel-${user._id}`}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        style={{ ...styles.btn, backgroundColor: colors.error }}
                        disabled={busy}
                        onClick={() => {
                          setSuspendingId(user._id);
                          setReason("");
                        }}
                        data-testid={`users-suspend-${user._id}`}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
