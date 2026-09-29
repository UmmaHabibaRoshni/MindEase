const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const chatAccess = require("../utils/chatAccess");
const { encrypt } = require("../utils/crypto");

module.exports = function initChat(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
  });

  // Auth on connect: client sends { auth: { token } }
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, status }
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_room", async ({ requestId } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const request = await chatAccess(socket.user, requestId);
        if (!request) return reply({ ok: false, message: "Not allowed in this chat" });
        socket.join(String(requestId));
        reply({ ok: true });
      } catch (err) {
        console.error(err);
        reply({ ok: false, message: "Server error" });
      }
    });

    socket.on("send_message", async ({ requestId, text } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (typeof text !== "string" || !text.trim() || text.length > 1000) {
          return reply({ ok: false, message: "Message must be 1-1000 characters" });
        }
        // re-check on every message: access can't be assumed from an old join
        const request = await chatAccess(socket.user, requestId);
        if (!request) return reply({ ok: false, message: "Not allowed in this chat" });

        const clean = text.trim();
        const msg = await Message.create({
          request: requestId,
          sender: socket.user.id,
          ...encrypt(clean),
        });

        io.to(String(requestId)).emit("new_message", {
          _id: msg._id,
          request: requestId,
          sender: socket.user.id,
          text: clean,
          createdAt: msg.createdAt,
        });
        reply({ ok: true });
      } catch (err) {
        console.error(err);
        reply({ ok: false, message: "Server error" });
      }
    });
  });

  return io;
};