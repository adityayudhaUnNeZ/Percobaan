const db = require("./config/db");

async function test() {
  try {
    const [rows] = await db.execute("SELECT 1");
    console.log("Database connected!");
  } catch (err) {
    console.error("Database error:", err);
  }
}

test();
