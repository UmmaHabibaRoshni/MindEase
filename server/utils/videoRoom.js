const crypto = require("crypto");

// Jitsi room naming for BL-18 (T18.1 decided a new tab, not an embed).
//
// A room name is derived from the record's id, so the same workshop or case
// always resolves to the same room and we store nothing. The id on its own is
// guessable - the seeker workshop list hands it out - so a short keyed digest
// is appended.
//
// VIDEO_ROOM_SECRET must be the SAME on every machine. The name is a function
// of the id and this salt, so two backends with different salts would send two
// people to two different rooms. The fallback below keeps a fresh clone
// working; the team sets a shared value in .env, like CHAT_KEY.
const salt = () => process.env.VIDEO_ROOM_SECRET || "mindease-dev-room-salt";

// Swap this for a self-hosted instance without touching any code.
const domain = () => process.env.JITSI_DOMAIN || "meet.jit.si";

const digest = (kind, id) =>
  crypto.createHmac("sha256", salt()).update(`${kind}:${id}`).digest("hex").slice(0, 10);

// e.g. mindease-workshop-6711f0...-3a9c1b7e05
const roomName = (kind, id) => `mindease-${kind}-${String(id)}-${digest(kind, id)}`;

// Everything the frontend needs for the button, plus the fields an embedded
// version would want later (T18.1), so swapping in an iframe needs no API change.
const roomFor = (kind, id, { displayName = "", subject = "", isModerator = false } = {}) => {
  const name = roomName(kind, id);
  const host = domain();
  return {
    roomName: name,
    domain: host,
    url: `https://${host}/${name}`,
    displayName,
    subject,
    isModerator,
  };
};

module.exports = { roomFor, roomName };
