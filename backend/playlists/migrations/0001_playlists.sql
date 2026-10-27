CREATE TABLE IF NOT EXISTS playlist_shares (
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL UNIQUE,
 payload TEXT NOT NULL,
 payload_bytes INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_share_limits (
 key TEXT PRIMARY KEY,
 hits INTEGER NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS playlist_limit_expiry ON playlist_share_limits(expires);
