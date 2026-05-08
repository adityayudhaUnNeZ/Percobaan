const db = require("../config/db");
const {
  isDbConnectionError,
  nextId,
  readStore,
  writeStore,
} = require("../utils/localStore");

let ensureTablePromise = null;

async function ensurePosterColumns() {
  const [updatedAtColumns] = await db.execute(`
    SHOW COLUMNS FROM posters LIKE 'updated_at'
  `);
  if (!updatedAtColumns.length) {
    await db.execute(`
      ALTER TABLE posters
      ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
    `);
  }
}

function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db
      .execute(`
        CREATE TABLE IF NOT EXISTS posters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          image_url VARCHAR(255) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_created_at (created_at)
        )
      `)
      .then(() => ensurePosterColumns());
  }
  return ensureTablePromise;
}

async function createPoster({ image_url }) {
  try {
    await ensureTable();
    const sql = `
      INSERT INTO posters (image_url)
      VALUES (?)
    `;
    const [result] = await db.execute(sql, [image_url]);
    return getPosterById(result.insertId);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const timestamp = new Date().toISOString();
    const poster = {
      id: nextId(store.posters),
      image_url,
      created_at: timestamp,
      updated_at: timestamp,
    };

    store.posters.push(poster);
    await writeStore(store);
    return poster;
  }
}

async function getPosterById(id) {
  try {
    await ensureTable();
    const [rows] = await db.execute(
      `
        SELECT id, image_url, created_at, updated_at
        FROM posters
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    return store.posters.find((poster) => Number(poster.id) === Number(id)) || null;
  }
}

async function getPosters() {
  try {
    await ensureTable();
    const [rows] = await db.execute(
      "SELECT * FROM posters ORDER BY created_at DESC, id DESC"
    );
    return rows;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    return [...store.posters].sort((a, b) => {
      const timeDiff =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return timeDiff !== 0 ? timeDiff : Number(b.id) - Number(a.id);
    });
  }
}

async function getLatestPoster() {
  try {
    await ensureTable();
    const [rows] = await db.execute(
      `
        SELECT id, image_url, created_at, updated_at
        FROM posters
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `
    );
    return rows[0] || null;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const posters = await getPosters();
    return posters[0] || null;
  }
}

module.exports = { createPoster, ensureTable, getLatestPoster, getPosterById, getPosters };
