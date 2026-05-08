const express = require("express");
const path = require("path");
const {
  verifyAdminCredentials,
  createAdminSession,
  setSessionCookie,
  clearSessionCookie,
  readAdminSession,
  destroyAdminSession,
  requireAdminGuest,
} = require("../middleware/adminAuth");

const router = express.Router();

router.get("/login", requireAdminGuest, (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/login.html"));
});

router.post("/login", requireAdminGuest, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username dan password wajib diisi." });
    }

    const result = await verifyAdminCredentials(username, password);
    if (!result.ok || !result.admin) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    const session = await createAdminSession(req, result.admin);
    setSessionCookie(res, session.token);
    return res.json({ success: true, redirect: "/admin/dashboard" });
  } catch (_error) {
    return res.status(500).json({ error: "Gagal memproses login." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const session = await readAdminSession(req);
    if (session?.tokenHash) await destroyAdminSession(session);
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (_error) {
    clearSessionCookie(res);
    res.status(500).json({ error: "Gagal logout." });
  }
});

module.exports = router;
