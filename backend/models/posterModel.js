const db = require("../config/db");

async function createPoster({ title, image_url }) {
  const sql = `
    INSERT INTO posters (title, image_url)
    VALUES (?, ?)
  `;
  await db.execute(sql, [title ?? null, image_url]);
}

async function getPosters() {
  const [rows] = await db.execute(
    "SELECT * FROM posters ORDER BY created_at DESC"
  );
  return rows;
}

module.exports = { createPoster, getPosters };
