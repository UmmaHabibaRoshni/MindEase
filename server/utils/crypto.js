const crypto = require("crypto");

const getKey = () => {
  const key = Buffer.from(process.env.CHAT_KEY || "", "hex");
  if (key.length !== 32) throw new Error("CHAT_KEY must be 64 hex chars (32 bytes)");
  return key;
};

exports.encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    content: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
};

exports.decrypt = ({ content, iv, tag }) => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(content, "base64")),
    decipher.final(),
  ]).toString("utf8");
};