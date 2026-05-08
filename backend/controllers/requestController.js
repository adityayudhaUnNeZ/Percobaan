const { createRequest, getRequests } = require("../models/requestModel");
const { getActiveSession } = require("../models/broadcastSessionModel");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

exports.addRequest = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const song_title = normalizeText(req.body?.song_title);
    const artist = normalizeText(req.body?.artist);
    const message = normalizeText(req.body?.message);

    if (!name || !song_title) {
      return res.status(400).json({
        error: "Field `name` dan `song_title` wajib diisi",
      });
    }
    if (
      name.length > 100 ||
      song_title.length > 150 ||
      artist.length > 120 ||
      message.length > 500
    ) {
      return res.status(400).json({
        error:
          "Panjang maksimum: name 100, song_title 150, artist 120, message 500 karakter",
      });
    }

    const activeSession = await getActiveSession();
    await createRequest({
      name,
      song_title,
      artist,
      message,
      session_id: activeSession?.id || null,
    });
    res.json({ message: "Request lagu masuk!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const data = await getRequests();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};