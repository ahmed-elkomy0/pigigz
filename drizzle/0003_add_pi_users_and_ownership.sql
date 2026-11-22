CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pi_uid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE gigs ADD COLUMN seller_pi_uid TEXT;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN buyer_pi_uid TEXT;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN seller_pi_uid TEXT;
--> statement-breakpoint
ALTER TABLE reviews ADD COLUMN buyer_pi_uid TEXT;
