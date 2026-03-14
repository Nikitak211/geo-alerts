const crypto = require("crypto");
const { normalizeEmail } = require("../utils/normalize");

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function requireUser(req, res, next) {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id" });
  }
  req.userId = userId;
  next();
}

module.exports = {
  hashPassword,
  normalizeEmail: normalizeEmail,
  requireUser,
};
