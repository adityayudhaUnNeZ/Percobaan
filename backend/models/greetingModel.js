const db = require("../config/db");

async function createGreeting({ name, origin, message }) {
  const sql = `
    INSERT INTO greetings (name, origin, message)
    VALUES (?, ?, ?)
  `;
  await db.execute(sql, [name, origin, message]);
}

async function getGreetings() {
  const [rows] = await db.execute(
    "SELECT * FROM greetings ORDER BY created_at DESC"
  );
  return rows;
}

module.exports = { createGreeting, getGreetings };
