ALTER TABLE users ADD COLUMN bio TEXT;
--> statement-breakpoint
CREATE TABLE job_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_name TEXT NOT NULL,
  buyer_pi_uid TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget_pi REAL NOT NULL,
  duration_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER REFERENCES gigs(id),
  title TEXT,
  source TEXT NOT NULL DEFAULT 'gig',
  job_request_id INTEGER REFERENCES job_requests(id),
  buyer_name TEXT NOT NULL,
  buyer_pi_uid TEXT,
  seller_pi_uid TEXT,
  brief TEXT NOT NULL,
  amount_pi REAL NOT NULL,
  commission_pi REAL NOT NULL,
  seller_net_pi REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_delivery',
  payment_ref TEXT NOT NULL,
  delivery_note TEXT,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  completed_at INTEGER
);
--> statement-breakpoint
INSERT INTO orders_new (id, gig_id, buyer_name, buyer_pi_uid, seller_pi_uid, brief, amount_pi, commission_pi, seller_net_pi, status, payment_ref, delivery_note, created_at, delivered_at, completed_at)
SELECT id, gig_id, buyer_name, buyer_pi_uid, seller_pi_uid, brief, amount_pi, commission_pi, seller_net_pi, status, payment_ref, delivery_note, created_at, delivered_at, completed_at FROM orders;
--> statement-breakpoint
DROP TABLE orders;
--> statement-breakpoint
ALTER TABLE orders_new RENAME TO orders;
--> statement-breakpoint
CREATE TABLE reviews_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  gig_id INTEGER REFERENCES gigs(id),
  buyer_name TEXT NOT NULL,
  buyer_pi_uid TEXT,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO reviews_new (id, order_id, gig_id, buyer_name, buyer_pi_uid, rating, comment, created_at)
SELECT id, order_id, gig_id, buyer_name, buyer_pi_uid, rating, comment, created_at FROM reviews;
--> statement-breakpoint
DROP TABLE reviews;
--> statement-breakpoint
ALTER TABLE reviews_new RENAME TO reviews;
--> statement-breakpoint
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  sender_pi_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_request_id INTEGER NOT NULL REFERENCES job_requests(id),
  seller_name TEXT NOT NULL,
  seller_pi_uid TEXT,
  price_pi REAL NOT NULL,
  delivery_days INTEGER NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE portfolio_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_pi_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link_url TEXT,
  category TEXT,
  created_at INTEGER NOT NULL
);
