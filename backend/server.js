const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.static(path.join(__dirname, "public")));

const ICECAST_STATS_URL =
  process.env.ICECAST_STATS_URL || "http://172.16.10.187:8000/status-json.xsl";
const ICECAST_MOUNT = process.env.ICECAST_MOUNT || "/radio";
const ICECAST_USER = process.env.ICECAST_USER || "admin";
const ICECAST_PASSWORD = process.env.ICECAST_PASSWORD || "hackme";
let liveListenerCount = 0;
const liveClients = new Set();
let lastUpdatedAt = null;

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
  const matched = sources.find((item) => item?.listenurl?.includes(mount));
  const target = matched || sources[0];
  const listeners = Number(target?.listeners);
  return Number.isFinite(listeners) ? listeners : null;
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
      broadcastListeners();
    }
  } catch {
    // keep last known value if request fails
  }
}

refreshListenerCount();
setInterval(refreshListenerCount, 8000);

app.get("/api/listeners", (_req, res) => {
  res.json({
    count: liveListenerCount,
    updatedAt: lastUpdatedAt || new Date().toISOString(),
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
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Minkes Radio running on http://localhost:${PORT}`);
});
