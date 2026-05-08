const db = require("../config/db");
const { ensureTable: ensurePosterTable } = require("./posterModel");
const {
  isDbConnectionError,
  nextId,
  readStore,
  writeStore,
} = require("../utils/localStore");

function sortByStartedAtDesc(items) {
  return [...items].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

function buildPosterMap(posters) {
  return new Map(posters.map((poster) => [Number(poster.id), poster]));
}

function withPoster(session, posterMap) {
  const poster = posterMap.get(Number(session.poster_id)) || null;
  return {
    ...session,
    poster_id: session.poster_id ?? null,
    poster_image_url: poster?.image_url ?? null,
    poster_created_at: poster?.created_at ?? null,
    poster_updated_at: poster?.updated_at ?? null,
  };
}

async function getLocalSessionById(id) {
  const store = await readStore();
  const session = store.broadcast_sessions.find(
    (item) => Number(item.id) === Number(id)
  );
  if (!session) return null;

  return withPoster(session, buildPosterMap(store.posters));
}

let ensureTablePromise = null;

async function ensurePosterColumn() {
  const [columns] = await db.execute(
    `
      SHOW COLUMNS FROM broadcast_sessions LIKE 'poster_id'
    `
  );

  if (!columns.length) {
    await db.execute(`
      ALTER TABLE broadcast_sessions
      ADD COLUMN poster_id INT NULL AFTER topic
    `);
  }
}

async function ensureMessageSessionColumns() {
  const [greetingSessionColumns] = await db.execute(
    `
      SHOW COLUMNS FROM greetings LIKE 'session_id'
    `
  );
  if (!greetingSessionColumns.length) {
    await db.execute(`
      ALTER TABLE greetings
      ADD COLUMN session_id INT NULL
    `);
  }

  const [requestSessionColumns] = await db.execute(
    `
      SHOW COLUMNS FROM song_requests LIKE 'session_id'
    `
  );
  if (!requestSessionColumns.length) {
    await db.execute(`
      ALTER TABLE song_requests
      ADD COLUMN session_id INT NULL
    `);
  }
}

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db
      .execute(`
      CREATE TABLE IF NOT EXISTS broadcast_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host_name VARCHAR(100) NOT NULL,
        program_title VARCHAR(150) NOT NULL,
        topic VARCHAR(150) NOT NULL,
        poster_id INT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        peak_listeners INT NOT NULL DEFAULT 0,
        peak_reached_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_started_at (started_at),
        INDEX idx_ended_at (ended_at)
      )
    `)
      .then(() => ensurePosterTable())
      .then(() => ensurePosterColumn())
      .then(() => ensureMessageSessionColumns());
  }
  return ensureTablePromise;
}

function parseOptionalPositiveInt(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function normalizeSort(sort, order) {
  const safeSort = String(sort || "").toLowerCase();
  const safeOrder = String(order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const columnMap = {
    started_at: "s.started_at",
    peak_listeners: "s.peak_listeners",
    host_name: "s.host_name",
  };
  return {
    sortColumn: columnMap[safeSort] || "s.started_at",
    sortOrder: safeOrder,
  };
}

async function getActiveSession() {
  try {
    await ensureTable();
    const [rows] = await db.execute(
      `
        SELECT
          s.id,
          s.host_name,
          s.program_title,
          s.topic,
          s.poster_id,
          s.started_at,
          s.ended_at,
          s.peak_listeners,
          s.peak_reached_at,
          p.image_url AS poster_image_url,
          p.created_at AS poster_created_at,
          p.updated_at AS poster_updated_at
        FROM broadcast_sessions s
        LEFT JOIN posters p ON p.id = s.poster_id
        WHERE s.ended_at IS NULL
        ORDER BY s.started_at DESC
        LIMIT 1
      `
    );
    return rows[0] || null;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const active = sortByStartedAtDesc(
      store.broadcast_sessions.filter((session) => !session.ended_at)
    )[0];
    if (!active) return null;

    return withPoster(active, buildPosterMap(store.posters));
  }
}

async function createSession({ host_name, program_title, topic, poster_id }) {
  try {
    await ensureTable();

    const [result] = await db.execute(
      `
        INSERT INTO broadcast_sessions (host_name, program_title, topic, poster_id)
        VALUES (?, ?, ?, ?)
      `,
      [host_name, program_title, topic, poster_id]
    );

    return getSessionById(result.insertId);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const timestamp = new Date().toISOString();
    const session = {
      id: nextId(store.broadcast_sessions),
      host_name,
      program_title,
      topic,
      poster_id,
      started_at: timestamp,
      ended_at: null,
      peak_listeners: 0,
      peak_reached_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    store.broadcast_sessions.push(session);
    await writeStore(store);
    return getLocalSessionById(session.id);
  }
}

async function getSessionById(id) {
  try {
    await ensureTable();
    const [rows] = await db.execute(
      `
        SELECT
          s.id,
          s.host_name,
          s.program_title,
          s.topic,
          s.poster_id,
          s.started_at,
          s.ended_at,
          s.peak_listeners,
          s.peak_reached_at,
          p.image_url AS poster_image_url,
          p.created_at AS poster_created_at,
          p.updated_at AS poster_updated_at
        FROM broadcast_sessions s
        LEFT JOIN posters p ON p.id = s.poster_id
        WHERE s.id = ?
        LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;
    return getLocalSessionById(id);
  }
}

async function stopSession(id) {
  try {
    await ensureTable();

    const [result] = await db.execute(
      `
        UPDATE broadcast_sessions
        SET ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND ended_at IS NULL
      `,
      [id]
    );

    if (!result.affectedRows) return null;
    return getSessionById(id);
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const session = store.broadcast_sessions.find(
      (item) => Number(item.id) === Number(id) && !item.ended_at
    );
    if (!session) return null;

    const timestamp = new Date().toISOString();
    session.ended_at = timestamp;
    session.updated_at = timestamp;
    await writeStore(store);
    return getLocalSessionById(id);
  }
}

async function stopActiveSession() {
  const active = await getActiveSession();
  if (!active) return null;
  return stopSession(active.id);
}

async function updateActiveSessionPeak(count, reachedAt) {
  const listenerCount = Number.isFinite(Number(count))
    ? Math.max(0, Number.parseInt(count, 10))
    : 0;

  if (!listenerCount) return;

  try {
    await ensureTable();
    await db.execute(
      `
        UPDATE broadcast_sessions
        SET
          peak_listeners = GREATEST(peak_listeners, ?),
          peak_reached_at = CASE
            WHEN ? > peak_listeners THEN ?
            ELSE peak_reached_at
          END
        WHERE id = (
          SELECT id
          FROM (
            SELECT id
            FROM broadcast_sessions
            WHERE ended_at IS NULL
            ORDER BY started_at DESC
            LIMIT 1
          ) latest
        )
      `,
      [listenerCount, listenerCount, reachedAt || new Date()]
    );
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const active = sortByStartedAtDesc(
      store.broadcast_sessions.filter((session) => !session.ended_at)
    )[0];
    if (!active) return;

    if (listenerCount > Number(active.peak_listeners || 0)) {
      active.peak_listeners = listenerCount;
      active.peak_reached_at = reachedAt || new Date().toISOString();
      active.updated_at = new Date().toISOString();
      await writeStore(store);
    }
  }
}

async function getSessionGreetings(sessionId) {
  try {
    const [rows] = await db.execute(
      `
        SELECT g.*
        FROM greetings g
        JOIN broadcast_sessions s ON s.id = ?
        WHERE g.session_id = s.id
           OR (
                g.session_id IS NULL
                AND g.created_at >= s.started_at
                AND g.created_at <= COALESCE(s.ended_at, CURRENT_TIMESTAMP)
              )
        ORDER BY g.created_at DESC
      `,
      [sessionId]
    );
    return rows;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const session = store.broadcast_sessions.find(
      (item) => Number(item.id) === Number(sessionId)
    );
    if (!session) return [];

    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at || new Date().toISOString()).getTime();

    return store.greetings
      .filter((item) => {
        if (Number(item.session_id) === Number(sessionId)) {
          return true;
        }
        const created = new Date(item.created_at).getTime();
        return created >= start && created <= end;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

async function getSessionRequests(sessionId) {
  try {
    const [rows] = await db.execute(
      `
        SELECT r.*
        FROM song_requests r
        JOIN broadcast_sessions s ON s.id = ?
        WHERE r.session_id = s.id
           OR (
                r.session_id IS NULL
                AND r.created_at >= s.started_at
                AND r.created_at <= COALESCE(s.ended_at, CURRENT_TIMESTAMP)
              )
        ORDER BY r.created_at DESC
      `,
      [sessionId]
    );
    return rows;
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const session = store.broadcast_sessions.find(
      (item) => Number(item.id) === Number(sessionId)
    );
    if (!session) return [];

    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at || new Date().toISOString()).getTime();

    return store.song_requests
      .filter((item) => {
        if (Number(item.session_id) === Number(sessionId)) {
          return true;
        }
        const created = new Date(item.created_at).getTime();
        return created >= start && created <= end;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

async function getSessionReport(sessionId) {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const [greetings, requests] = await Promise.all([
    getSessionGreetings(sessionId),
    getSessionRequests(sessionId),
  ]);

  return {
    ...session,
    poster:
      session.poster_id && session.poster_image_url
        ? {
            id: session.poster_id,
            image_url: session.poster_image_url,
            created_at: session.poster_created_at,
            updated_at: session.poster_updated_at,
          }
        : null,
    greetings_count: greetings.length,
    requests_count: requests.length,
    greetings,
    requests,
  };
}

async function listSessionSummaries(options = {}) {
  const safeLimit = parseOptionalPositiveInt(options.limit);
  const page = Math.max(1, parseOptionalPositiveInt(options.page) || 1);
  const offset = safeLimit ? (page - 1) * safeLimit : 0;
  const q = String(options.q || "").trim();
  const host = String(options.host || "").trim();
  const date = String(options.date || "").trim();
  const { sortColumn, sortOrder } = normalizeSort(options.sort, options.order);
  try {
    await ensureTable();
    const where = ["s.ended_at IS NOT NULL"];
    const params = [];
    if (q) {
      where.push("(s.host_name LIKE ? OR s.program_title LIKE ? OR s.topic LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (host) {
      where.push("s.host_name LIKE ?");
      params.push(`%${host}%`);
    }
    if (date) {
      where.push("DATE(s.started_at) = ?");
      params.push(date);
    }
    const whereClause = `WHERE ${where.join(" AND ")}`;
    const baseQuery = `
        SELECT
          s.id,
          s.host_name,
          s.program_title,
          s.topic,
          s.poster_id,
          s.started_at,
          s.ended_at,
          s.peak_listeners,
          s.peak_reached_at,
          p.image_url AS poster_image_url,
          p.created_at AS poster_created_at,
          p.updated_at AS poster_updated_at,
          (
            SELECT COUNT(*)
            FROM greetings g
            WHERE g.session_id = s.id
               OR (
                    g.session_id IS NULL
                    AND g.created_at >= s.started_at
                    AND g.created_at <= COALESCE(s.ended_at, CURRENT_TIMESTAMP)
                  )
          ) AS greetings_count,
          (
            SELECT COUNT(*)
            FROM song_requests r
            WHERE r.session_id = s.id
               OR (
                    r.session_id IS NULL
                    AND r.created_at >= s.started_at
                    AND r.created_at <= COALESCE(s.ended_at, CURRENT_TIMESTAMP)
                  )
          ) AS requests_count
        FROM broadcast_sessions s
        LEFT JOIN posters p ON p.id = s.poster_id
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
      `;
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM broadcast_sessions s
      ${whereClause}
    `;
    const [countRows] = await db.execute(countQuery, params);
    const total_items = Number(countRows?.[0]?.total || 0);
    const total_pages = safeLimit ? Math.max(1, Math.ceil(total_items / safeLimit)) : 1;
    const query = safeLimit ? `${baseQuery}\n      LIMIT ? OFFSET ?` : baseQuery;
    const [rows] = await db.execute(
      query,
      safeLimit ? [...params, safeLimit, offset] : params
    );
    const items = rows.map((row) => ({
      ...row,
      poster:
        row.poster_id && row.poster_image_url
          ? {
              id: row.poster_id,
              image_url: row.poster_image_url,
              created_at: row.poster_created_at,
              updated_at: row.poster_updated_at,
            }
          : null,
    }));
    return {
      items,
      page,
      limit: safeLimit || items.length,
      total_items,
      total_pages,
    };
  } catch (error) {
    if (!isDbConnectionError(error)) throw error;

    const store = await readStore();
    const posterMap = buildPosterMap(store.posters);
    const endedSessions = sortByStartedAtDesc(
      store.broadcast_sessions.filter((session) => session.ended_at)
    );
    const filteredSessions = endedSessions.filter((session) => {
      const qText = String(q || "").toLowerCase();
      const hostText = String(host || "").toLowerCase();
      const sessionText = `${session.host_name || ""} ${session.program_title || ""} ${session.topic || ""}`.toLowerCase();
      const queryMatch = !qText || sessionText.includes(qText);
      const hostMatch = !hostText || String(session.host_name || "").toLowerCase().includes(hostText);
      const dateMatch = !date || new Date(session.started_at).toISOString().slice(0, 10) === date;
      return queryMatch && hostMatch && dateMatch;
    });
    const total_items = filteredSessions.length;
    const total_pages = safeLimit ? Math.max(1, Math.ceil(total_items / safeLimit)) : 1;
    const pagedSessions = safeLimit
      ? filteredSessions.slice(offset, offset + safeLimit)
      : filteredSessions;

    const items = pagedSessions.map((session) => {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.ended_at).getTime();
      const greetings_count = store.greetings.filter((item) => {
        if (Number(item.session_id) === Number(session.id)) {
          return true;
        }
        const created = new Date(item.created_at).getTime();
        return created >= start && created <= end;
      }).length;
      const requests_count = store.song_requests.filter((item) => {
        if (Number(item.session_id) === Number(session.id)) {
          return true;
        }
        const created = new Date(item.created_at).getTime();
        return created >= start && created <= end;
      }).length;
      const row = withPoster(session, posterMap);
      return {
        ...row,
        poster:
          row.poster_id && row.poster_image_url
            ? {
                id: row.poster_id,
                image_url: row.poster_image_url,
                created_at: row.poster_created_at,
                updated_at: row.poster_updated_at,
              }
            : null,
        greetings_count,
        requests_count,
      };
    });
    return {
      items,
      page,
      limit: safeLimit || items.length,
      total_items,
      total_pages,
    };
  }
}

module.exports = {
  createSession,
  getActiveSession,
  getSessionById,
  getSessionReport,
  listSessionSummaries,
  stopActiveSession,
  updateActiveSessionPeak,
};
