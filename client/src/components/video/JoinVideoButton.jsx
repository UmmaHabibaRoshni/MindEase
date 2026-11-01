import React, { useState } from "react";
import { roomLoaders, openRoom, errorMessage } from "../../api/videoApi";

// T18.6 - the one button used everywhere a video call can be joined: the
// workshop card (T18.7), the psychologist case page (T18.8) and the seeker
// request page (T18.9).
//
// It asks the server for the room only when it is clicked. That matters: the
// API is also the access check, so a button that fetched on mount would hit
// the server once per card in a list, and would have to hide itself on 403.
// Clicking is also when the seeker has decided to join, which is when a
// refused answer is worth showing them.
//
// Per the T18.1 spike the room opens in a new tab; this component never
// renders a call itself.

const baseButton = {
  backgroundColor: "#2b6cb0",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "13px",
};

const busyButton = { ...baseButton, backgroundColor: "#90cdf4", cursor: "default" };

export default function JoinVideoButton({
  kind,
  id,
  label = "Join video session",
  startLabel = "Start video session",
  onOpened,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Filled in after a successful fetch, so the wording can change to "Start"
  // for whoever is expected to open the room first.
  const [room, setRoom] = useState(null);

  const load = roomLoaders[kind];

  const handleClick = async () => {
    if (!load) {
      setError("This kind of video room is not supported.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await load(id);
      setRoom(data);
      if (!data?.url) {
        setError("The server did not return a room link.");
        return;
      }
      openRoom(data.url);
      if (onOpened) onOpened(data);
    } catch (err) {
      setError(errorMessage(err, "Could not open the video room. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        style={busy ? busyButton : baseButton}
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? "Opening..." : room?.isModerator ? startLabel : label}
      </button>

      {error && (
        <p role="alert" style={{ color: "crimson", fontSize: "12px", margin: "6px 0 0" }}>
          {error}
        </p>
      )}

      {room?.url && !error && (
        <p style={{ color: "#718096", fontSize: "12px", margin: "6px 0 0" }}>
          The call opened in a new tab. If nothing happened,{" "}
          <a href={room.url} target="_blank" rel="noopener noreferrer">
            open it here
          </a>
          .
        </p>
      )}
    </div>
  );
}
