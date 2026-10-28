-- A random id made once for this copy, sent with the daily version check so Dozokit can count
-- copies in use. share = 0 (Settings → Updates) asks GitHub instead and sends nothing.
CREATE TABLE install (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  uid TEXT NOT NULL,
  share INTEGER NOT NULL DEFAULT 1
);
