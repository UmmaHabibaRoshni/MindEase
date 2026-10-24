const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");
const chatAccess = require("../utils/chatAccess");
const { encrypt } = require("../utils/crypto");

// T16.1 - a suspended (or deleted) account must not use the chat, even with a
// token that has not expired yet. Checked on connect and again on every event,
// so an admin suspending someone cuts them off mid-conversation.
async function accountBlocked(userId) {
  const account = await User.findById(userId).select("status");
  return !account || account.status === "suspended";
}

module.exports = function initChat(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
  });

  // Auth on connect: client sends { auth: { token } }
  io.use(async (socket, next) => {
    let user;
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, status }
    } catch {
      return next(new Error("Invalid or expired token"));
    }

    try {
      if (await accountBlocked(user.id)) return next(new Error("Account suspended"));
    } catch {
      return next(new Error("Could not verify your account"));
    }

    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join_room", async ({ requestId } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (await accountBlocked(socket.user.id)) {
          return reply({ ok: false, message: "Your account has been suspended" });
        }
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
        if (await accountBlocked(socket.user.id)) {
          return reply({ ok: false, message: "Your account has been suspended" });
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