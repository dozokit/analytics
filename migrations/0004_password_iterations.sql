-- PBKDF2 rounds a hash was made with. 100,000 cost 15 ms of CPU, over the Workers Free plan's 10 ms,
-- so new hashes use 10,000; an older row is made again at 10,000 on its next correct password.
ALTER TABLE password ADD COLUMN iterations INTEGER NOT NULL DEFAULT 100000;
