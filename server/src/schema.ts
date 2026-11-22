import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const CATEGORIES = [
  "design",
  "code",
  "video",
  "translation",
  "writing",
  "marketing",
] as const;

/**
 * Cities a freelancer can pick as their location for the explore map.
 * Keys only live here; display names and coordinates live in the client.
 * The user picks their own city — no location is ever inferred.
 */
export const CITY_KEYS = [
  "cairo",
  "giza",
  "alexandria",
  "mansoura",
  "tanta",
  "zagazig",
  "ismailia",
  "portsaid",
  "suez",
  "faiyum",
  "benisuef",
  "minya",
  "asyut",
  "sohag",
  "qena",
  "luxor",
  "aswan",
  "hurghada",
  "sharm",
  "damietta",
  "riyadh",
  "jeddah",
  "mecca",
  "medina",
  "dammam",
  "dubai",
  "abudhabi",
  "sharjah",
  "doha",
  "kuwait",
  "manama",
  "muscat",
  "amman",
  "irbid",
  "beirut",
  "damascus",
  "aleppo",
  "baghdad",
  "basra",
  "erbil",
  "ramallah",
  "gaza",
  "tunis",
  "algiers",
  "oran",
  "casablanca",
  "rabat",
  "marrakech",
  "tripoli",
  "khartoum",
  "sanaa",
  "aden",
  "nouakchott",
] as const;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  piUid: text("pi_uid").notNull().unique(),
  username: text("username").notNull(),
  /** Pi wallet address, captured when the user grants the wallet_address scope at login. Needed as the on-chain destination for app_to_user payouts. */
  walletAddress: text("wallet_address"),
  bio: text("bio"),
  city: text("city", { enum: CITY_KEYS }),
  verified: integer("verified").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const gigs = sqliteTable("gigs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerName: text("seller_name").notNull(),
  sellerPiUid: text("seller_pi_uid"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  pricePi: real("price_pi").notNull(),
  deliveryDays: integer("delivery_days").notNull(),
  status: text("status", { enum: ["active", "paused"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gigId: integer("gig_id").references(() => gigs.id),
  title: text("title"),
  source: text("source", { enum: ["gig", "job_request"] })
    .notNull()
    .default("gig"),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  buyerName: text("buyer_name").notNull(),
  buyerPiUid: text("buyer_pi_uid"),
  sellerPiUid: text("seller_pi_uid"),
  brief: text("brief").notNull(),
  amountPi: real("amount_pi").notNull(),
  commissionPi: real("commission_pi").notNull(),
  sellerNetPi: real("seller_net_pi").notNull(),
  status: text("status", {
    enum: ["awaiting_delivery", "delivered", "completed", "cancelled"],
  })
    .notNull()
    .default("awaiting_delivery"),
  paymentRef: text("payment_ref").notNull(),
  /** Pi Platform payment identifier of the buyer→app (user_to_app) payment. */
  piPaymentId: text("pi_payment_id"),
  /** Blockchain txid of the completed user_to_app payment. */
  piTxid: text("pi_txid"),
  /**
   * Lifecycle of the user_to_app payment: simulated (no server API key
   * configured, Testnet simulation), pending, approved, completed, failed,
   * cancelled.
   */
  paymentStatus: text("payment_status", {
    enum: ["simulated", "pending", "approved", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("simulated"),
  /** Pi Platform payment identifier of the app→freelancer (app_to_user) payout. */
  payoutId: text("payout_id"),
  /** Blockchain txid of the submitted app_to_user payout transaction. */
  payoutTxid: text("payout_txid"),
  /**
   * Lifecycle of the app_to_user payout: pending (created, not yet sent),
   * submitted (transaction sent, awaiting completion), completed, failed,
   * simulated (instant release while server payout secrets are not set).
   */
  payoutStatus: text("payout_status", {
    enum: ["pending", "submitted", "completed", "failed", "simulated"],
  }),
  /** Deterministic per-order key so a payout is never created twice. */
  payoutIdempotencyKey: text("payout_idempotency_key"),
  /** Last payout error (sanitized; never contains any secret). */
  payoutError: text("payout_error"),
  deliveryNote: text("delivery_note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/**
 * A buyer's intent to pay, created server-side BEFORE Pi.createPayment runs
 * on the client. The server verifies the Pi payment against this row
 * (amount, buyer uid, metadata intent id) before approving/completing it,
 * and only a completed payment creates the real order — exactly once,
 * because the intent flips to "completed" with the order id stored on it.
 */
export const paymentIntents = sqliteTable("payment_intents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["gig", "offer"] }).notNull(),
  buyerPiUid: text("buyer_pi_uid").notNull(),
  buyerName: text("buyer_name").notNull(),
  gigId: integer("gig_id").references(() => gigs.id),
  offerId: integer("offer_id").references(() => offers.id),
  brief: text("brief").notNull(),
  amountPi: real("amount_pi").notNull(),
  commissionPi: real("commission_pi").notNull(),
  sellerNetPi: real("seller_net_pi").notNull(),
  sellerPiUid: text("seller_pi_uid"),
  piPaymentId: text("pi_payment_id").unique(),
  piTxid: text("pi_txid"),
  status: text("status", {
    enum: ["awaiting_payment", "approved", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("awaiting_payment"),
  orderId: integer("order_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  senderPiUid: text("sender_pi_uid").notNull(),
  senderName: text("sender_name").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const jobRequests = sqliteTable("job_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buyerName: text("buyer_name").notNull(),
  buyerPiUid: text("buyer_pi_uid"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  budgetPi: real("budget_pi").notNull(),
  durationDays: integer("duration_days").notNull(),
  status: text("status", { enum: ["open", "awarded", "cancelled"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const offers = sqliteTable("offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobRequestId: integer("job_request_id")
    .notNull()
    .references(() => jobRequests.id),
  sellerName: text("seller_name").notNull(),
  sellerPiUid: text("seller_pi_uid"),
  pricePi: real("price_pi").notNull(),
  deliveryDays: integer("delivery_days").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const portfolioItems = sqliteTable("portfolio_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerPiUid: text("owner_pi_uid").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  linkUrl: text("link_url"),
  category: text("category", { enum: CATEGORIES }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  gigId: integer("gig_id").references(() => gigs.id),
  buyerName: text("buyer_name").notNull(),
  buyerPiUid: text("buyer_pi_uid"),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
