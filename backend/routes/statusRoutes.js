const express = require("express");
const router = express.Router();
const axios = require("axios");

const ICECAST_STATS_URL =
  process.env.ICECAST_STATS_URL || "http://172.17.10.33:8000/status-json.xsl";
const ICECAST_MOUNT = process.env.ICECAST_MOUNT || "/radio";

function isSourceLive(source) {
  if (!source) return false;
  const listenUrl = String(source.listenurl || "");
  const mount = String(source.mount || "");
  const sameMount =
    (ICECAST_MOUNT && listenUrl.includes(ICECAST_MOUNT)) ||
    (ICECAST_MOUNT && mount === ICECAST_MOUNT);
  return Boolean(sameMount && source.title !== null);
}

router.get("/", async (req, res) => {
  try {
    const response = await axios.get(ICECAST_STATS_URL);

    const source = response.data.icestats.source;

    let isLive = false;

    if (Array.isArray(source)) {
      isLive = source.some(isSourceLive);
    } else {
      isLive = isSourceLive(source);
    }

    res.json({
      isLive,
    });
  } catch (err) {
    res.json({
      isLive: false,
    });
  }
});

module.exports = router;
