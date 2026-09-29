const Message = require("../models/Message");
const chatAccess = require("../utils/chatAccess");
const { decrypt } = require("../utils/crypto");

// GET /api/chat/:requestId/messages
exports.getMessages = async (req, res) => {
  try {
    const request = await chatAccess(req.user, req.params.requestId);
    if (!request) return res.status(403).json({ message: "Not allowed in this chat" });

    const docs = await Message.find({ request: req.params.requestId }).sort({ createdAt: 1 });
    const messages = docs.map((m) => ({
      _id: m._id,
      sender: m.sender,
      text: decrypt(m),
      createdAt: m.createdAt,
    }));
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};