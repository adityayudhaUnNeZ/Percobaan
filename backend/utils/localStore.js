const fs = require("fs/promises");
const path = require("path");

const storePath = path.join(__dirname, "..", "..", "data", "local-db.json");

function createEmptyStore() {
  return {
    posters: [],
    broadcast_sessions: [],
    greetings: [],
    song_requests: [],
  };
}

function isDbConnectionError(error) {
  return [
    "ECONNREFUSED",
    "PROTOCOL_CONNECTION_LOST",
    "ETIMEDOUT",
    "ENOTFOUND",
  ].includes(error?.code);
}

async function readStore() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyStore(),
      ...parsed,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      const initial = createEmptyStore();
      await writeStore(initial);
      return initial;
    }
    throw error;
  }
}

async function writeStore(data) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

function nextId(items) {
  const maxId = items.reduce((max, item) => {
    const currentId = Number(item?.id) || 0;
    return currentId > max ? currentId : max;
  }, 0);
  return maxId + 1;
}

module.exports = {
  isDbConnectionError,
  nextId,
  readStore,
  writeStore,
};
