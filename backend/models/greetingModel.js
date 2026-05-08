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
        SHOW COLUMNS FROM greetings LIKE 'session_id'
      `)
      .then(async ([rows]) => {
        if (!rows.length) {
          await db.execute(`
            ALTER TABLE greetings
            ADD COLUMN session_id INT NULL
          `);
        }
      });
  }
  return ensureSessionColumnPromise;
}

async function createGreeting({ name, origin, message, session_id = null }) {
  try {
    await ensureSessionColumn();
    const sql = `
      INSERT INTO greetings (name, origin, message, session_id)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(sql, [name, origin, message, session_id]);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const timestamp = new Date().toISOString();
    store.greetings.push({
      id: nextId(store.greetings),
      name,
      origin,
      message,
      session_id,
      created_at: timestamp,
    });
    await writeStore(store);
  }
}

async function getGreetings() {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM greetings ORDER BY created_at DESC"
    );
    return rows;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    return [...store.greetings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

module.exports = { createGreeting, getGreetings };
