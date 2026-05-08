CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  role ENUM('super_admin', 'operator') NOT NULL DEFAULT 'operator',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token_hash (token_hash),
  KEY idx_admin_sessions_admin_id (admin_id),
  KEY idx_admin_sessions_expires_at (expires_at),
  CONSTRAINT fk_admin_sessions_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  meta_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_logs_admin_id (admin_id),
  KEY idx_admin_audit_logs_created_at (created_at),
  CONSTRAINT fk_admin_audit_logs_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE SET NULL
);

-- Seed admin awal (ganti username/password sesuai kebutuhan).
-- Hash memakai SHA2-256 agar cocok dengan middleware saat ini.
INSERT INTO admins (username, password_hash, role, is_active)
SELECT 'admin', SHA2('ganti-password-kuat', 256), 'super_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM admins WHERE username = 'admin'
);
