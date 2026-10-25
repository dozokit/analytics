-- The password set in Settings, as a PBKDF2 hash. secret_mac ties it to the PASSWORD secret it
-- replaced: once that secret is edited in Cloudflare, this row stops counting.
CREATE TABLE password (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  secret_mac TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);
