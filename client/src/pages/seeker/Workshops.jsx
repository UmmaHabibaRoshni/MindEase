
import React, { useCallback, useEffect, useState } from "react";
import {
  getAvailableWorkshops,
  enrollInWorkshop,
  cancelEnrollment,
  errorMessage,
} from "../../api/workshopApi";
import { startWorkshopPayment, goToGateway } from "../../api/paymentApi";
import JoinVideoButton from "../../components/video/JoinVideoButton";

// T17.8 - a workshop is paid only when the facilitator entered an amount above
// zero. The server sends an isPaid virtual; price is checked too so the card is
// right even if a caller sends a plain object.
const isPaid = (w) => w.isPaid === true || Number(w.price) > 0;

// T18.7 - only an online workshop that is still going ahead has a room. The
// API checks this again; this just avoids showing a button that would 400.
const hasVideoRoom = (w) => w.mode === "Online" && w.status !== "Cancelled";
const priceLabel = (w) => (isPaid(w) ? `${Number(w.price)} BDT` : "Free");

const primaryButton = {
  backgroundColor: "#2f855a",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "13px",
};

const disabledButton = {
  ...primaryButton,
  backgroundColor: "#e2e8f0",
  color: "#718096",
  cursor: "not-allowed",
};

const payButton = {
  ...primaryButton,
  backgroundColor: "#2b6cb0",
};

const outlineButton = {
  backgroundColor: "#fff",
  color: "#9b2c2c",
  border: "1px solid #feb2b2",
  padding: "8px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "13px",
};

export default function Workshops() {
  const [workshops, setWorkshops] = useState([]);
  // ids this seeker has joined. Filled from the server's isEnrolled flag and
  // kept up to date locally as the seeker enrolls and cancels.
  const [enrolledIds, setEnrolledIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getAvailableWorkshops();
      const list = Array.isArray(data) ? data : [];
      setWorkshops(list);
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        list.forEach((w) => {
          if (w.isEnrolled) next.add(w._id);
        });
        return next;
      });
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Could not load workshops."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markEnrolled = (id, yes) =>
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleEnroll = async (w) => {
    setBusyId(w._id);
    setNotice("");
    try {
      await enrollInWorkshop(w._id);
      markEnrolled(w._id, true);
      setNotice(`You are enrolled in "${w.title}".`);
    } catch (err) {
      const message = errorMessage(err, "Could not enroll. Try again.");
      if (err.response?.status === 409 && /already enrolled/i.test(message)) {
        markEnrolled(w._id, true); // the server already has this enrollment
      }
      setNotice(message);
    } finally {
      setBusyId(null);
      load(); // refresh the seat counts
    }
  };

  // T17.8 - paid workshops do not enroll here. The server saves a pending
  // payment and returns the gateway URL; the seeker is enrolled by the
  // callbacks only once SSLCommerz confirms the payment (T17.4).
  const handlePay = async (w) => {
    setBusyId(w._id);
    setNotice("");
    try {
      const { gatewayUrl } = await startWorkshopPayment(w._id);
      if (!gatewayUrl) {
        setNotice("Could not start the payment. Try again.");
        setBusyId(null);
        return;
      }
      goToGateway(gatewayUrl); // leaves the app
    } catch (err) {
      setNotice(errorMessage(err, "Could not start the payment. Try again."));
      setBusyId(null);
      load();
    }
  };

  const handleCancel = async (w) => {
    setBusyId(w._id);
    setNotice("");
    try {
      await cancelEnrollment(w._id);
      markEnrolled(w._id, false);
      setNotice(`Your enrollment in "${w.title}" is cancelled.`);
    } catch (err) {
      const message = errorMessage(err, "Could not cancel. Try again.");
      if (err.response?.status === 404) markEnrolled(w._id, false);
      setNotice(message);
    } finally {
      setBusyId(null);
      load();
    }
  };

  const renderAction = (w) => {
    const busy = busyId === w._id;
    const enrolled = enrolledIds.has(w._id);
    const full = w.isFull || (w.seatsAvailable !== undefined && w.seatsAvailable <= 0);

    if (enrolled) {
      return (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ color: "#22543d", fontWeight: "600", fontSize: "13px" }}>You are enrolled</span>
            <button style={outlineButton} disabled={busy} onClick={() => handleCancel(w)}>
              {busy ? "Cancelling..." : "Cancel enrollment"}
            </button>
          </div>
          {hasVideoRoom(w) && (
            <div style={{ marginTop: "12px" }}>
              <JoinVideoButton kind="workshop" id={w._id} label="Join video session" />
            </div>
          )}
          {isPaid(w) && (
            <p style={{ color: "#975a16", fontSize: "12px", margin: "8px 0 0" }}>
              You paid for this workshop. Cancelling does not refund the fee.
            </p>
          )}
        </div>
      );
    }
    if (full) {
      return (
        <button style={disabledButton} disabled>
          Full
        </button>
      );
    }
    if (isPaid(w)) {
      return (
        <button style={payButton} disabled={busy} onClick={() => handlePay(w)}>
          {busy ? "Opening payment..." : `Pay ${Number(w.price)} BDT & Enroll`}
        </button>
      );
    }
    return (
      <button style={primaryButton} disabled={busy} onClick={() => handleEnroll(w)}>
        {busy ? "Enrolling..." : "Enroll"}
      </button>
    );
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ margin: 0, color: "#2d3748", fontSize: "24px", fontWeight: "600" }}>Workshops</h2>
      <p style={{ margin: "4px 0 24px", color: "#718096", fontSize: "14px" }}>
        Join a workshop run by one of our facilitators.
      </p>

      {notice && (
        <p role="status" style={{ backgroundColor: "#f0fff4", border: "1px solid #c6f6d5", color: "#22543d", padding: "10px 14px", borderRadius: "6px", fontSize: "14px" }}>
          {notice}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#718096" }}>Loading workshops...</p>
      ) : error ? (
        <p role="alert" style={{ color: "crimson" }}>{error}</p>
      ) : workshops.length === 0 ? (
        <p style={{ color: "#718096" }}>No workshops are open right now. Check back soon.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {workshops.map((w) => (
            <div
              key={w._id}
              style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, color: "#2d3748", fontSize: "18px" }}>{w.title}</h3>
                <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start" }}>
                  <span style={{ backgroundColor: "#e2e8f0", color: "#2d3748", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
                    {w.mode}
                  </span>
                  <span
                    style={{
                      backgroundColor: isPaid(w) ? "#bee3f8" : "#c6f6d5",
                      color: isPaid(w) ? "#2a4365" : "#22543d",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {priceLabel(w)}
                  </span>
                </div>
              </div>

              <p style={{ color: "#4a5568", fontSize: "14px", margin: "8px 0" }}>{w.description}</p>

              <p style={{ color: "#718096", fontSize: "13px", margin: "0 0 14px" }}>
                {new Date(w.date).toLocaleDateString()} at {w.time}, {w.durationMinutes} minutes
                {w.facilitator?.name ? `, with ${w.facilitator.name}` : ""}
                {w.seatsAvailable !== undefined ? `. Seats left: ${w.seatsAvailable} of ${w.capacity}.` : ""}
              </p>

              {renderAction(w)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}