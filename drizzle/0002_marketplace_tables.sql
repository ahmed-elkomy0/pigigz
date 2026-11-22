DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE gigs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price_pi REAL NOT NULL,
  delivery_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER NOT NULL REFERENCES gigs(id),
  buyer_name TEXT NOT NULL,
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
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  gig_id INTEGER NOT NULL REFERENCES gigs(id),
  buyer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
