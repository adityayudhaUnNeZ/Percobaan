const db = require("../config/db");

async function findAdminByUsername(username) {
  const sql = `
    SELECT id, username, password_hash, role, is_active, created_at, updated_at
    FROM admins
    WHERE username = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [username]);
  return rows[0] || null;
}

async function createAdminSession({
  adminId,
  tokenHash,
  expiresAt,
  ipAddress = null,
  userAgent = null,
}) {
  const sql = `
    INSERT INTO admin_sessions (
      admin_id,
      token_hash,
      ip_address,
      user_agent,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?)
  `;
  await db.execute(sql, [adminId, tokenHash, ipAddress, userAgent, expiresAt]);
}

async function findActiveSessionByTokenHash(tokenHash) {
  const sql = `
    SELECT
      s.id AS session_id,
      s.admin_id,
      s.expires_at,
      a.username,
      a.role,
      a.is_active
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND a.is_active = 1
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [tokenHash]);
  return rows[0] || null;
}

async function revokeSessionByTokenHash(tokenHash) {
  const sql = `
    UPDATE admin_sessions
    SET revoked_at = NOW()
    WHERE token_hash = ? AND revoked_at IS NULL
  `;
  await db.execute(sql, [tokenHash]);
}

async function cleanupExpiredSessions() {
  const sql = `
    UPDATE admin_sessions
    SET revoked_at = NOW()
    WHERE revoked_at IS NULL AND expires_at <= NOW()
  `;
  await db.execute(sql);
}

async function writeAdminAuditLog({ adminId = null, action, meta = null }) {
  const sql = `
    INSERT INTO admin_audit_logs (admin_id, action, meta_json)
    VALUES (?, ?, ?)
  `;
  await db.execute(sql, [
    adminId,
    action,
    meta ? JSON.stringify(meta) : null,
  ]);
}

module.exports = {
  findAdminByUsername,
  createAdminSession,
  findActiveSessionByTokenHash,
  revokeSessionByTokenHash,
  cleanupExpiredSessions,
  writeAdminAuditLog,
};
