const {
  createSession,
  getActiveSession,
  getSessionReport,
  listSessionSummaries,
  stopActiveSession,
} = require("../models/broadcastSessionModel");
const { getLatestPoster, getPosterById } = require("../models/posterModel");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSessionId(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePosterId(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

exports.startSession = async (req, res) => {
  try {
    const hostName = normalizeText(req.body?.host_name);
    const programTitle = normalizeText(req.body?.program_title) || "Siaran";
    const topic = normalizeText(req.body?.topic);
    const posterId = parsePosterId(req.body?.poster_id);

    if (!hostName || !topic || !posterId) {
      return res.status(400).json({
        error: "Nama penyiar, tema, dan poster terbaru wajib diisi.",
      });
    }

    if (hostName.length > 100 || programTitle.length > 150 || topic.length > 150) {
      return res.status(400).json({
        error:
          "Panjang maksimum: host_name 100, program_title 150, topic 150 karakter",
      });
    }

    const active = await getActiveSession();
    if (active) {
      return res.status(409).json({
        error: "Masih ada sesi siaran aktif. Hentikan dulu sebelum mulai sesi baru.",
        active,
      });
    }

    const poster = await getPosterById(posterId);
    if (!poster) {
      return res.status(400).json({
        error: "Poster tidak ditemukan. Upload poster terbaru terlebih dahulu.",
      });
    }

    const latestPoster = await getLatestPoster();
    if (!latestPoster || latestPoster.id !== posterId) {
      return res.status(409).json({
        error:
          "Gunakan poster paling baru untuk memulai siaran. Upload atau pilih poster terbaru terlebih dahulu.",
      });
    }

    const session = await createSession({
      host_name: hostName,
      program_title: programTitle,
      topic,
      poster_id: posterId,
    });

    const report = await getSessionReport(session.id);

    return res.json({
      message: "Sesi siaran dimulai",
      session: report,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getActiveSession = async (_req, res) => {
  try {
    const active = await getActiveSession();
    if (!active) {
      return res.json({ active: null });
    }

    const report = await getSessionReport(active.id);

    return res.json({ active: report });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.stopSession = async (_req, res) => {
  try {
    const stopped = await stopActiveSession();
    if (!stopped) {
      return res.status(404).json({ error: "Tidak ada sesi siaran aktif." });
    }

    const report = await getSessionReport(stopped.id);

    return res.json({
      message: "Sesi siaran dihentikan",
      session: report,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.listSessions = async (req, res) => {
  try {
    const data = await listSessionSummaries({
      page: req.query?.page,
      limit: req.query?.limit,
      q: req.query?.q,
      host: req.query?.host,
      date: req.query?.date,
      sort: req.query?.sort,
      order: req.query?.order,
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getSessionReport = async (req, res) => {
  try {
    const sessionId = parseSessionId(req.params?.id);
    if (!sessionId) {
      return res.status(400).json({ error: "ID sesi tidak valid." });
    }

    const report = await getSessionReport(sessionId);
    if (!report) {
      return res.status(404).json({ error: "Sesi tidak ditemukan." });
    }

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
