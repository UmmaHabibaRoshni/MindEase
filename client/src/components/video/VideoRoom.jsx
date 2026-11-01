import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { roomLoaders, openRoom, errorMessage } from "../../api/videoApi";

// T18.6 - the video room page.
//
// The T18.1 spike settled on opening Jitsi in a new tab, so this is a landing
// page rather than a player: it fetches the room, shows who it is with and
// whether this person is expected to open it, and gives them the link. The
// fields an embedded version would need (domain, roomName) are already in the
// response, so swapping to an iframe later touches only this file.
//
// Used by the route /dashboard/video/:kind/:id, where kind is workshop,
// case or request.

const card = {
  backgroundColor: "#fff",
  padding: "24px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const primaryButton = {
  backgroundColor: "#2b6cb0",
  color: "#fff",
  border: "none",
  padding: "10px 20px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "14px",
};

export function VideoRoomView({ kind, id }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const loader = roomLoaders[kind];
    if (!loader) {
      setError("This kind of video room is not supported.");
      setLoading(false);
      return;
    }
    try {
      setRoom(await loader(id));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Could not open the video room."));
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ color: "#718096" }}>Loading the video room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <div style={card}>
          <h2 style={{ margin: "0 0 8px", color: "#2d3748", fontSize: "20px" }}>
            Video room unavailable
          </h2>
          <p role="alert" style={{ color: "crimson", margin: 0, fontSize: "14px" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <h2 style={{ margin: 0, color: "#2d3748", fontSize: "24px", fontWeight: "600" }}>
        {room.subject || "Video session"}
      </h2>
      <p style={{ margin: "4px 0 24px", color: "#718096", fontSize: "14px" }}>
        {room.isModerator
          ? "You are expected to open this call. Whoever joins first becomes the host."
          : "Join when the session starts. You may be held in a waiting room until the host arrives."}
      </p>

      <div style={card}>
        <button type="button" style={primaryButton} onClick={() => openRoom(room.url)}>
          {room.isModerator ? "Start video session" : "Join video session"}
        </button>

        <p style={{ color: "#718096", fontSize: "13px", margin: "16px 0 0" }}>
          The call opens in a new tab on <strong>{room.domain}</strong>. If your
          browser blocked it,{" "}
          <a href={room.url} target="_blank" rel="noopener noreferrer">
            open the room directly
          </a>
          .
        </p>

        <p style={{ color: "#a0aec0", fontSize: "12px", margin: "12px 0 0" }}>
          Room: <code>{room.roomName}</code>
        </p>
      </div>

      <p style={{ color: "#975a16", fontSize: "12px", margin: "16px 0 0" }}>
        Anyone who knows this room name can enter it. Do not share the link
        outside the session.
      </p>
    </div>
  );
}

// Route wrapper: /dashboard/video/:kind/:id
export default function VideoRoom() {
  const { kind, id } = useParams();
  return <VideoRoomView kind={kind} id={id} />;
}
