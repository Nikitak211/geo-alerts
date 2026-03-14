const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://app:app@localhost:5432/bets",
});

module.exports = { pool };
