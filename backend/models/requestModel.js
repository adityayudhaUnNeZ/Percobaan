const db = require("../config/db");

async function createRequest({ name, song_title, artist, message }) {
  const sql = `
    INSERT INTO song_requests (name, song_title, artist, message)
    VALUES (?, ?, ?, ?)
  `;
  await db.execute(sql, [name, song_title, artist, message]);
}

async function getRequests() {
  const [rows] = await db.execute(
    "SELECT * FROM song_requests WHERE status = 'pending'"
  );
  return rows;
}

module.exports = { createRequest, getRequests };
