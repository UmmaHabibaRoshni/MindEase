import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import MessageBubble from "./MessageBubble";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// merge by _id so history + live messages never show twice
const mergeMessages = (prev, incoming) => {
  const byId = new Map(prev.map((m) => [String(m._id), m]));
  incoming.forEach((m) => byId.set(String(m._id), m));
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
};

const STATUS_COLOR = { ready: "#38a169", connecting: "#d69e2e", error: "#e53e3e" };
const STATUS_LABEL = { ready: "Connected", connecting: "Connecting...", error: "Not connected" };

export default function ChatWindow({ requestId, currentUserId, title = "Support chat" }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [status, setStatus] = useState("connecting"); // connecting | ready | error
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!requestId) return undefined;

    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("error");
      setError("You are not logged in.");
      return undefined;
    }

    setMessages([]);
    setStatus("connecting");
    setError("");

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("new_message", (m) => {
      if (String(m.request) === String(requestId)) {
        setMessages((prev) => mergeMessages(prev, [m]));
      }
    });

    socket.on("connect_error", (err) => {
      setStatus("error");
      setError(err.message || "Could not connect to chat.");
    });

    socket.on("disconnect", () => setStatus("connecting"));

    // runs on the first connect and again after every reconnect
    socket.on("connect", () => {
      socket.emit("join_room", { requestId }, async (res) => {
        if (!res?.ok) {
          setStatus("error");
          setError(res?.message || "Could not join the chat.");
          return;
        }
        try {
          const history = await axios.get(`/api/chat/${requestId}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessages((prev) => mergeMessages(prev, history.data.messages || []));
          setStatus("ready");
          setError("");
        } catch (err) {
          setStatus("error");
          setError(err.response?.data?.message || "Could not load messages.");
        }
      });
    });

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || status !== "ready" || !socketRef.current) return;

    // do NOT add the message here: the server sends it back via "new_message"
    socketRef.current.emit("send_message", { requestId, text }, (res) => {
      if (res?.ok) {
        setInputMessage("");
        setError("");
      } else {
        setError(res?.message || "Message not sent.");
      }
    });
  };

  const canSend = status === "ready" && inputMessage.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "520px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: "#f7faf8",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: STATUS_COLOR[status],
            }}
          />
          <div>
            <h4 style={{ margin: 0, color: "#2d3748", fontSize: "16px", fontWeight: "600" }}>
              {title}
            </h4>
            <span style={{ fontSize: "12px", color: "#718096" }}>{STATUS_LABEL[status]}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "20px",
          overflowY: "auto",
          backgroundColor: "#f7faf8",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {status === "connecting" && <p style={{ color: "#718096" }}>Connecting...</p>}
        {status === "error" && <p style={{ color: "crimson" }}>{error}</p>}
        {status === "ready" && messages.length === 0 && (
          <p style={{ color: "#718096" }}>No messages yet.</p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m._id}
            message={{ ...m, time: formatTime(m.createdAt) }}
            isOwnMessage={String(m.sender) === String(currentUserId)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {status === "ready" && error && (
        <p style={{ margin: 0, padding: "8px 20px", color: "crimson", fontSize: "13px" }}>
          {error}
        </p>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "16px 20px",
          backgroundColor: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message here..."
          maxLength={1000}
          disabled={status !== "ready"}
          style={{
            flex: 1,
            padding: "12px 18px",
            borderRadius: "24px",
            border: "1px solid #cbd5e0",
            backgroundColor: "#f7faf8",
            fontSize: "14px",
            color: "#2d3748",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            backgroundColor: canSend ? "#2f855a" : "#a0aec0",
            color: "#ffffff",
            border: "none",
            padding: "12px 24px",
            borderRadius: "24px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
} 