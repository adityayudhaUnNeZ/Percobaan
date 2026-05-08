const crypto = require("crypto");
const {
  findAdminByUsername,
  createAdminSession: createAdminSessionRecord,
  findActiveSessionByTokenHash,
  revokeSessionByTokenHash,
  cleanupExpiredSessions,
  writeAdminAuditLog,
} = require("../models/adminAuthModel");

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function parseCookies(req) {
  const header = req.headers?.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function secureEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function normalizeHash(value) {
  return String(value || "").trim().toLowerCase();
}

async function verifyAdminCredentials(username, password) {
  const admin = await findAdminByUsername(username);
  if (!admin || !admin.is_active) return { ok: false, admin: null };
  const expectedHash = normalizeHash(admin.password_hash);
  const actualHash = normalizeHash(sha256(password));
  const ok = secureEquals(actualHash, expectedHash);
  return { ok, admin: ok ? admin : null };
}

async function createAdminSession(req, admin) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await createAdminSessionRecord({
    adminId: admin.id,
    tokenHash,
    expiresAt,
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });
  await writeAdminAuditLog({
    adminId: admin.id,
    action: "LOGIN_SUCCESS",
    meta: { ip_address: getClientIp(req) },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function readAdminSession(req) {
  await cleanupExpiredSessions();
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = await findActiveSessionByTokenHash(tokenHash);
  if (!session) return null;
  return { token, tokenHash, ...session };
}

function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProduction) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

async function requireAdminAuth(req, res, next) {
  try {
    const session = await readAdminSession(req);
    if (!session) {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return res.redirect("/admin/login");
    }
    req.adminSession = session;
    next();
  } catch (_error) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(500).json({ error: "Auth check failed" });
    }
    return res.redirect("/admin/login");
  }
}

async function requireAdminGuest(req, res, next) {
  try {
    const session = await readAdminSession(req);
    if (session) return res.redirect("/admin/dashboard");
    next();
  } catch (_error) {
    next();
  }
}

async function destroyAdminSession(session) {
  if (!session?.tokenHash) return;
  await revokeSessionByTokenHash(session.tokenHash);
  await writeAdminAuditLog({
    adminId: session.admin_id || null,
    action: "LOGOUT",
    meta: { session_id: session.session_id || null },
  });
}

module.exports = {
  verifyAdminCredentials,
  createAdminSession,
  readAdminSession,
  setSessionCookie,
  clearSessionCookie,
  requireAdminAuth,
  requireAdminGuest,
  destroyAdminSession,
};
