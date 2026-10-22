import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  readError,
} from "../../api/notificationApi";

// T15.7 (BL-15) - the navbar bell.
//
// Closed, it shows the unread count and nothing else, so it costs one small
// request. The list is only fetched when the bell is opened.
//
// Tailwind is not installed in this project, so the styles are inline, the
// same as the other pages I have written.

const POLL_MS = 30000;

// Over 9 the badge would stretch the bell out of shape.
const badgeText = (n) => (n > 9 ? "9+" : String(n));

function timeAgo(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const styles = {
  wrap: { position: "relative", display: "inline-block" },
  bell: {
    position: "relative",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
    padding: "6px 8px",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: "18px",
    height: "18px",
    padding: "0 4px",
    borderRadius: "9px",
    backgroundColor: "#e53e3e",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "18px",
    textAlign: "center",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    width: "320px",
    maxHeight: "400px",
    overflowY: "auto",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 50,
    textAlign: "left",
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid #edf2f7",
  },
  title: { fontSize: "14px", fontWeight: 600, color: "#2d3748" },
  markAll: {
    background: "none",
    border: "none",
    color: "#2b6cb0",
    cursor: "pointer",
    fontSize: "12px",
    padding: 0,
  },
  item: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    borderBottom: "1px solid #f7fafc",
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#2d3748",
  },
  unread: { backgroundColor: "#ebf8ff", fontWeight: 600 },
  when: { display: "block", marginTop: "4px", fontSize: "11px", color: "#718096" },
  empty: { padding: "16px 12px", fontSize: "13px", color: "#718096" },
};

export default function NotificationBell() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const wrapRef = useRef(null);

  // The count ticks over on its own; the list is not fetched until the bell is
  // opened, so an idle tab costs one small request every 30 seconds.
  //
  // The state update sits behind an await and an `active` check so the effect
  // never sets state synchronously (react-hooks/set-state-in-effect), and a
  // reply that arrives after the bell unmounts is dropped.
  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const count = await getUnreadCount();
        if (active) setUnread(count);
      } catch {
        // A failed poll must not clear a count that is already on screen, and
        // it must not put an error in front of someone who did not ask for one.
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Clicking anywhere else closes the panel.
  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const list = await getNotifications();
      setItems(list);
      setUnread(list.filter((n) => !n.read).length);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  };

  const openItem = async (item) => {
    // Update the screen first: the row should not sit there looking unread
    // while a request is in flight.
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      try {
        await markRead(item._id);
      } catch {
        // Put it back rather than lie about it.
        setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: false } : n)));
        setUnread((n) => n + 1);
      }
    }

    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const onMarkAll = async () => {
    const previous = items;
    const previousUnread = unread;

    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await markAllRead();
    } catch (err) {
      setItems(previous);
      setUnread(previousUnread);
      setError(readError(err, "Could not mark everything as read."));
    }
  };

  return (
    <div style={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        style={styles.bell}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        data-testid="bell-button"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span style={styles.badge} data-testid="bell-badge">
            {badgeText(unread)}
          </span>
        )}
      </button>

      {open && (
        <div style={styles.panel} role="menu" data-testid="bell-panel">
          <div style={styles.head}>
            <span style={styles.title}>Notifications</span>
            {items.some((n) => !n.read) && (
              <button type="button" onClick={onMarkAll} style={styles.markAll} data-testid="bell-mark-all">
                Mark all read
              </button>
            )}
          </div>

          {loading && (
            <p style={styles.empty} data-testid="bell-loading">
              Loading...
            </p>
          )}

          {!loading && error && (
            <p style={{ ...styles.empty, color: "#c53030" }} role="alert" data-testid="bell-error">
              {error}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <p style={styles.empty} data-testid="bell-empty">
              You have no notifications yet.
            </p>
          )}

          {!loading &&
            !error &&
            items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => openItem(item)}
                style={item.read ? styles.item : { ...styles.item, ...styles.unread }}
                data-testid={`bell-item-${item._id}`}
              >
                {item.message}
                <span style={styles.when}>{timeAgo(item.createdAt)}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
