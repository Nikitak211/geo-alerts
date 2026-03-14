async function getOrCreateUserWallet(client, userId, { forUpdate = false } = {}) {
  const selectSql = `
    SELECT user_id, available_balance, reserved_balance
    FROM user_wallets
    WHERE user_id = $1
    ${forUpdate ? "FOR UPDATE" : ""}
  `;
  const res = await client.query(selectSql, [userId]);
  if (res.rows[0]) return res.rows[0];
  const insertRes = await client.query(
    `
    INSERT INTO user_wallets (user_id, available_balance, reserved_balance)
    VALUES ($1, 0, 0)
    RETURNING user_id, available_balance, reserved_balance
    `,
    [userId],
  );
  return insertRes.rows[0];
}

function buildWalletResponseRow(row) {
  return {
    id: row.id,
    email: row.email,
    wallet: {
      availableBalance: Number(row.available_balance ?? 0),
      reservedBalance: Number(row.reserved_balance ?? 0),
      totalBalance:
        Number(row.available_balance ?? 0) + Number(row.reserved_balance ?? 0),
    },
  };
}

module.exports = {
  getOrCreateUserWallet,
  buildWalletResponseRow,
};
