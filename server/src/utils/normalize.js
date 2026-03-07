function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeAreaName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

module.exports = {
  normalizeEmail,
  normalizeAreaName,
};
