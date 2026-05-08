const db = require("../config/db");
const {
  isDbConnectionError,
  nextId,
  readStore,
  writeStore,
} = require("../utils/localStore");

let ensureSessionColumnPromise = null;

async function ensureSessionColumn() {
  if (!ensureSessionColumnPromise) {
    ensureSessionColumnPromise = db
      .execute(`
        SHOW COLUMNS FROM song_requests LIKE 'session_id'
      `)
      .then(async ([rows]) => {
        if (!rows.length) {
          await db.execute(`
            ALTER TABLE song_requests
            ADD COLUMN session_id INT NULL
          `);
        }
      });
  }
  return ensureSessionColumnPromise;
}

async function createRequest({
  name,
  song_title,
  artist,
  message,
  session_id = null,
}) {
  try {
    await ensureSessionColumn();
    const sql = `
      INSERT INTO song_requests (name, song_title, artist, message, session_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db.execute(sql, [name, song_title, artist, message, session_id]);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const timestamp = new Date().toISOString();
    store.song_requests.push({
      id: nextId(store.song_requests),
      name,
      song_title,
      artist,
      message,
      session_id,
      status: "pending",
      created_at: timestamp,
    });
    await writeStore(store);
  }
}

async function getRequests() {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM song_requests WHERE status = 'pending'"
    );
    return rows;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    return store.song_requests.filter(
      (request) => String(request.status || "pending") === "pending"
    );
  }
}

module.exports = { createRequest, getRequests };
