const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");
const cors = require("cors");
const { updateActiveSessionPeak } = require("./models/broadcastSessionModel");
const {
  requireAdminAuth,
} = require("./middleware/adminAuth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/admin", require("./routes/authRoutes"));
app.get("/admin/dashboard", requireAdminAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dashboard.html"));
});
app.get("/dashboard.html", requireAdminAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dashboard.html"));
});

app.use("/api/greetings", require("./routes/greetingRoutes"));
app.use("/api/requests", require("./routes/requestRoutes"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/posters", require("./routes/posterRoutes"));
app.use("/api/status", require("./routes/statusRoutes"));
app.use("/api/broadcast-sessions", require("./routes/broadcastSessionRoutes"));

app.use(express.static(path.join(__dirname, "../frontend")));

const ICECAST_STATS_URL =
  process.env.ICECAST_STATS_URL || "http://172.17.10.103:8000/status-json.xsl";
const ICECAST_MOUNT = process.env.ICECAST_MOUNT || "/radio";
const ICECAST_USER = process.env.ICECAST_USER || "";
const ICECAST_PASSWORD = process.env.ICECAST_PASSWORD || "";
let liveListenerCount = 0;
const liveClients = new Set();
let lastUpdatedAt = null;
let lastRefreshError = null;

function broadcastListeners() {
  const payload = JSON.stringify({
    count: liveListenerCount,
    updatedAt: lastUpdatedAt || new Date().toISOString(),
  });
  for (const res of liveClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

function parseIcecastListeners(data, mount) {
  const source = data?.icestats?.source;
  if (!source) return null;
  const sources = Array.isArray(source) ? source : [source];
  const normalizedMount = String(mount || "").trim();
  const matched = sources.find((item) => {
    const listenUrl = String(item?.listenurl || "");
    const itemMount = String(item?.mount || "");
    return (
      (normalizedMount && listenUrl.includes(normalizedMount)) ||
      (normalizedMount && itemMount === normalizedMount)
    );
  });
  const target = matched || sources[0];
  const listenerCandidates = [
    target?.listeners,
    target?.listener,
    target?.connected,
    target?.clients,
  ];
  for (const value of listenerCandidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function fetchIcecastStats(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const headers = {};
    if (ICECAST_USER && ICECAST_PASSWORD) {
      const token = Buffer.from(`${ICECAST_USER}:${ICECAST_PASSWORD}`).toString(
        "base64"
      );
      headers.Authorization = `Basic ${token}`;
    }
    const req = client.get(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Icecast status ${res.statusCode}`));
          res.resume();
          return;
        }
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("Icecast request timeout"));
    });
  });
}

async function refreshListenerCount() {
  try {
    const data = await fetchIcecastStats(ICECAST_STATS_URL);
    const listeners = parseIcecastListeners(data, ICECAST_MOUNT);
    if (typeof listeners === "number") {
      liveListenerCount = listeners;
      lastUpdatedAt = new Date().toISOString();
      await updateActiveSessionPeak(listeners, lastUpdatedAt).catch(() => {
        // Keep listener endpoint healthy even when session update fails.
      });
      lastRefreshError = null;
      broadcastListeners();
      return;
    }
    lastRefreshError = "Listener count was not found in Icecast stats payload";
  } catch (err) {
    // keep last known value if request fails
    lastRefreshError =
      err && err.message
        ? `Failed to refresh listener count from Icecast: ${err.message}`
        : "Failed to refresh listener count from Icecast";
  }
}

refreshListenerCount();
setInterval(refreshListenerCount, 8000);

app.get("/api/listeners", (_req, res) => {
  res.json({
    count: liveListenerCount,
    updatedAt: lastUpdatedAt || new Date().toISOString(),
    error: lastRefreshError,
  });
});

app.get("/api/live-listeners", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  liveClients.add(res);
  res.write(
    `data: ${JSON.stringify({
      count: liveListenerCount,
      updatedAt: lastUpdatedAt || new Date().toISOString(),
    })}\n\n`
  );

  req.on("close", () => {
    liveClients.delete(res);
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

module.exports = app;
