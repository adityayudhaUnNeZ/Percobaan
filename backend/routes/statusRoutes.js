const express = require("express");
const router = express.Router();
const axios = require("axios");

// cek dari icecast
router.get("/", async (req, res) => {
  try {
    const response = await axios.get(
      "http://172.17.10.193:8000/status-json.xsl"
    );

    const source = response.data.icestats.source;

    // kalau array (lebih dari 1 mount)
    let isLive = false;

    if (Array.isArray(source)) {
      const liveSource = source.find((s) => s.listenurl.includes("/radio"));
      isLive = liveSource && liveSource.title !== null;
    } else {
      isLive = source && source.title !== null;
    }

    res.json({
      isLive: isLive,
    });
  } catch (err) {
    res.json({
      isLive: false,
    });
  }
});

module.exports = router;
