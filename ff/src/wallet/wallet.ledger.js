async function insertLedger(client, params) {
  const {
    userId,
    kind,
    amount,
    bucket,
    ref_type = null,
    ref_id = null,
    note = null,
  } = params;
  await client.query(
    `
    INSERT INTO wallet_ledger (
      user_id,
      kind,
      amount,
      bucket,
      ref_type,
      ref_id,
      note
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [userId, kind, amount, bucket, ref_type, ref_id, note],
  );
}

module.exports = { insertLedger };
