import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { privileged } from "@space/privileged";
import * as schema from "./schema";

const COMMISSION_RATE = 0.1;

/* ------------------------------------------------------------------ */
/* Real Pi payments (Pi Platform API)                                  */
/*                                                                     */
/* All secret handling lives in server/src/privileged.ts: the server   */
/* API key (PI_NETWORK_API_KEY) and the app wallet seed                */
/* (PI_WALLET_SEED) are read there from server environment variables   */
/* the developer enters in the secret manager — action code here only  */
/* ever receives booleans, parsed Pi API responses, and txids.         */
/* When the API key is not configured, the marketplace keeps running   */
/* the clearly labeled Testnet simulation exactly as before, and real  */
/* payments switch on automatically once the developer sets the vars.  */
/* ------------------------------------------------------------------ */

type PiPlatformPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown> | null;
  from_address?: string;
  to_address?: string;
  direction: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: { txid: string; verified: boolean } | null;
};

async function piConfig(ctx: Ctx): Promise<{
  paymentsEnabled: boolean;
  payoutsEnabled: boolean;
}> {
  return await ctx.executePrivileged(privileged.piConfig, {});
}

/** Calls the Pi Platform API (https://api.minepi.com/v2) via the privileged handler that holds the server API key. */
async function piApi(
  ctx: Ctx,
  path: string,
  init: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const { data } = await ctx.executePrivileged(privileged.piApi, {
    path,
    method: init.method ?? "GET",
    body: init.body,
  });
  return data;
}

async function getPiPayment(
  ctx: Ctx,
  paymentId: string,
): Promise<PiPlatformPayment> {
  const data = await piApi(ctx, `/payments/${encodeURIComponent(paymentId)}`);
  return data as unknown as PiPlatformPayment;
}

function roundPi(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const categoryEnum = z.enum(schema.CATEGORIES);
const gigStatusEnum = z.enum(["active", "paused"]);
const orderStatusEnum = z.enum([
  "awaiting_delivery",
  "delivered",
  "completed",
  "cancelled",
]);

/**
 * Identity as returned by the real Pi SDK on the client:
 * Pi.authenticate(["username", "payments", "wallet_address"]) ->
 * { accessToken, user: { uid, username, walletAddress? } }.
 * Every mutating action carries it, and the server re-checks it on each call
 * (see requirePiUser) instead of trusting a stored session.
 */
const piAuthShape = z.object({
  piUid: z.string().trim().min(1).max(128),
  username: z.string().trim().min(1).max(64),
  accessToken: z.string().trim().min(10).max(4096),
  walletAddress: z.string().trim().min(40).max(64).optional(),
});
type PiAuth = z.infer<typeof piAuthShape>;

const piUserShape = z.object({
  id: z.number(),
  piUid: z.string(),
  username: z.string(),
  verified: z.boolean(),
  gigCount: z.number(),
  boughtCount: z.number(),
  soldCount: z.number(),
});

/**
 * Verifies the Pi access token against the Pi Platform API (GET /v2/me with
 * the user's own token — this endpoint needs no app API key) and upserts the
 * local user row. When the Pi API cannot be reached from the server, the
 * SDK-issued identity is accepted but stored as unverified; a definitive
 * rejection from the Pi API (bad/expired token or a uid/username mismatch)
 * fails the call.
 */
async function requirePiUser(
  ctx: Ctx,
  auth: PiAuth,
): Promise<{ id: number; piUid: string; username: string; verified: boolean }> {
  let verified = false;
  let walletAddress = auth.walletAddress ?? null;
  try {
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const me = (await res.json()) as {
        uid?: string;
        username?: string;
        wallet_address?: string;
      };
      if (me.uid !== auth.piUid || me.username !== auth.username) {
        throw new Error("بيانات دخول Pi مش متطابقة. سجّل خروج وادخل تاني.");
      }
      verified = true;
      if (!walletAddress && typeof me.wallet_address === "string" && me.wallet_address)
        walletAddress = me.wallet_address;
    } else if (res.status === 401 || res.status === 403) {
      throw new Error("توكن Pi غير صالح أو انتهى. سجّل خروج وادخل تاني من Pi Browser.");
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Pi") || e.message.includes("توكن"))) {
      throw e;
    }
    // Network failure reaching the Pi API: fall through with verified = false.
  }

  const db = ctx.db<typeof schema>();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.piUid, auth.piUid))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    await db
      .update(schema.users)
      .set({
        username: auth.username,
        verified: verified ? 1 : existing[0].verified,
        walletAddress: walletAddress ?? existing[0].walletAddress,
        lastLoginAt: now,
      })
      .where(eq(schema.users.id, existing[0].id));
    return {
      id: existing[0].id,
      piUid: auth.piUid,
      username: auth.username,
      verified: verified || existing[0].verified === 1,
    };
  }
  const inserted = await db
    .insert(schema.users)
    .values({
      piUid: auth.piUid,
      username: auth.username,
      walletAddress,
      verified: verified ? 1 : 0,
      createdAt: now,
      lastLoginAt: now,
    })
    .returning({ id: schema.users.id });
  const row = inserted[0];
  if (!row) throw new Error("piLogin: insert returned no rows");
  return { id: row.id, piUid: auth.piUid, username: auth.username, verified };
}

/**
 * Loads an order and checks the caller is one of its two parties (buyer or
 * seller). Pre-login legacy orders (both uids null) stay manageable by any
 * signed-in user, matching the rest of the marketplace's legacy handling.
 */
async function loadOrderParty(
  ctx: Ctx,
  user: { piUid: string },
  orderId: number,
) {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  const order = rows[0];
  if (!order) throw new Error("الطلب مش موجود");
  const isBuyer = !order.buyerPiUid || order.buyerPiUid === user.piUid;
  const isSeller = !order.sellerPiUid || order.sellerPiUid === user.piUid;
  if (!isBuyer && !isSeller)
    throw new Error("الشات والطلب ده متاحين لأطراف الطلب بس");
  return { order, isBuyer, isSeller };
}

/** Completed orders a freelancer needs before the verified badge shows. */
const VERIFIED_BADGE_MIN_COMPLETED = 3;

function sanitizePaymentError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "unknown error";
  // Error text is stored/shown, so keep it short; it never contains secrets
  // because our own errors never embed the API key or the wallet seed.
  return msg.slice(0, 300);
}

type PaymentIntentRow = typeof schema.paymentIntents.$inferSelect;

/**
 * Creates the real order for a payment intent whose Pi payment completed.
 * Idempotent: an intent that already produced an order returns that order
 * instead of creating a second one.
 */
async function fulfillIntent(
  ctx: Ctx,
  intent: PaymentIntentRow,
): Promise<{ orderId: number }> {
  const db = ctx.db<typeof schema>();
  if (intent.orderId != null) return { orderId: intent.orderId };
  if (intent.status === "completed")
    throw new Error("الدفعة دي اتحوّلت لطلب قبل كده");
  if (!intent.piPaymentId)
    throw new Error("الدفعة لسه مفيهاش معرّف دفع من Pi");

  const orderValues = {
    buyerName: intent.buyerName,
    buyerPiUid: intent.buyerPiUid,
    sellerPiUid: intent.sellerPiUid,
    brief: intent.brief,
    amountPi: intent.amountPi,
    commissionPi: intent.commissionPi,
    sellerNetPi: intent.sellerNetPi,
    paymentRef: intent.piPaymentId,
    piPaymentId: intent.piPaymentId,
    piTxid: intent.piTxid,
    paymentStatus: "completed" as const,
  };

  let orderId: number;
  if (intent.kind === "gig") {
    if (intent.gigId == null) throw new Error("بيانات الدفعة ناقصة");
    const gigRows = await db
      .select()
      .from(schema.gigs)
      .where(eq(schema.gigs.id, intent.gigId))
      .limit(1);
    const gig = gigRows[0];
    if (!gig) throw new Error("الخدمة دي مش موجودة");
    const inserted = await db
      .insert(schema.orders)
      .values({ ...orderValues, gigId: gig.id, title: gig.title, source: "gig" })
      .returning({ id: schema.orders.id });
    const row = inserted[0];
    if (!row) throw new Error("fulfillIntent: order insert returned no rows");
    orderId = row.id;
  } else {
    if (intent.offerId == null) throw new Error("بيانات الدفعة ناقصة");
    const offerRows = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.id, intent.offerId))
      .limit(1);
    const offer = offerRows[0];
    if (!offer) throw new Error("العرض مش موجود");
    if (offer.status !== "pending") throw new Error("العرض ده اتحسم قبل كده");
    const reqRows = await db
      .select()
      .from(schema.jobRequests)
      .where(eq(schema.jobRequests.id, offer.jobRequestId))
      .limit(1);
    const req = reqRows[0];
    if (!req) throw new Error("طلب الشغل مش موجود");
    if (req.status !== "open") throw new Error("طلب الشغل ده اتقفل قبل كده");
    const allOffers = await db
      .select()
      .from(schema.offers)
      .where(eq(schema.offers.jobRequestId, req.id));
    const statements: BatchItem<"sqlite">[] = [
      db
        .insert(schema.orders)
        .values({
          ...orderValues,
          gigId: null,
          title: req.title,
          source: "job_request",
          jobRequestId: req.id,
        })
        .returning({ id: schema.orders.id }),
      db
        .update(schema.offers)
        .set({ status: "accepted" })
        .where(eq(schema.offers.id, offer.id)),
      ...allOffers
        .filter((o) => o.id !== offer.id && o.status === "pending")
        .map((o) =>
          db
            .update(schema.offers)
            .set({ status: "rejected" })
            .where(eq(schema.offers.id, o.id)),
        ),
      db
        .update(schema.jobRequests)
        .set({ status: "awarded" })
        .where(eq(schema.jobRequests.id, req.id)),
    ];
    const [first, ...rest] = statements;
    if (!first) throw new Error("fulfillIntent: no statements");
    const results = await db.batch([first, ...rest]);
    const inserted = (results[0] as { id: number }[])[0];
    if (!inserted) throw new Error("fulfillIntent: order insert returned no rows");
    orderId = inserted.id;
  }

  await db
    .update(schema.paymentIntents)
    .set({ status: "completed", orderId })
    .where(eq(schema.paymentIntents.id, intent.id));
  ctx.invalidateQueries();
  return { orderId };
}

/**
 * Runs (or resumes) the app_to_user payout for a completed order:
 * create the Pi payment (server key) → sign & submit on-chain (wallet
 * seed) → complete it (server key). Every step persists its identifiers
 * and status before moving on, and the deterministic idempotency key plus
 * the stored payout id guarantee a payout is never created twice —
 * retries resume from the stored state. Never throws: failures are
 * recorded on the order as payout_status = "failed" with the error.
 */
async function attemptPayout(ctx: Ctx, orderId: number): Promise<void> {
  const db = ctx.db<typeof schema>();
  try {
    const rows = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    const order = rows[0];
    if (!order || order.status !== "completed") return;
    if (order.payoutStatus === "completed" || order.payoutStatus === "simulated")
      return;
    if (!order.sellerPiUid) {
      await db
        .update(schema.orders)
        .set({
          payoutStatus: "failed",
          payoutError:
            "الفريلانسر ملوش حساب Pi مربوط بالطلب، فالدفع التلقائي مش متاح — الدفع بيتم يدويًا.",
        })
        .where(eq(schema.orders.id, orderId));
      return;
    }

    const idempotencyKey = `pigigz-payout-order-${orderId}`;
    if (!order.payoutIdempotencyKey) {
      await db
        .update(schema.orders)
        .set({ payoutIdempotencyKey: idempotencyKey })
        .where(eq(schema.orders.id, orderId));
    }

    const cfg = await piConfig(ctx);
    if (!cfg.paymentsEnabled) {
      // Whole app is in the labeled Testnet simulation: release is instant
      // and simulated, exactly as before this change.
      await db
        .update(schema.orders)
        .set({ payoutStatus: "simulated", payoutError: null })
        .where(eq(schema.orders.id, orderId));
      return;
    }
    if (!cfg.payoutsEnabled) {
      await db
        .update(schema.orders)
        .set({
          payoutStatus: "pending",
          payoutError:
            "الدفعة معلّقة: المطوّر لسه محطش PI_WALLET_SEED في إعدادات أسرار السيرفر عشان التطبيق يقدر يدفع للفريلانسر.",
        })
        .where(eq(schema.orders.id, orderId));
      return;
    }

    const sellerRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.piUid, order.sellerPiUid))
      .limit(1);
    const destination = sellerRows[0]?.walletAddress ?? null;
    if (!destination) {
      await db
        .update(schema.orders)
        .set({
          payoutStatus: "failed",
          payoutError:
            "عنوان محفظة الفريلانسر مش معروف — لازم الفريلانسر يسجّل دخول من جديد ويوافق على صلاحية عنوان المحفظة، وبعدين إعادة المحاولة هتكمل الدفع.",
        })
        .where(eq(schema.orders.id, orderId));
      return;
    }

    // Step 1: create the A2U payment on the Pi Platform (once — the stored
    // payout id makes every retry resume instead of creating a duplicate).
    let payoutId = order.payoutId;
    if (!payoutId) {
      const created = await piApi(ctx, "/payments", {
        method: "POST",
        body: {
          payment: {
            amount: order.sellerNetPi,
            memo: `PiGigz payout for order #${orderId}`,
            metadata: { orderId, type: "freelancer_payout" },
            uid: order.sellerPiUid,
          },
        },
      });
      payoutId =
        typeof created.identifier === "string" ? created.identifier : null;
      if (!payoutId) throw new Error("Pi لم يرجع معرّف دفعة للفريلانسر");
      await db
        .update(schema.orders)
        .set({ payoutId, payoutStatus: "pending", payoutError: null })
        .where(eq(schema.orders.id, orderId));
    }

    // Step 2: sign & submit the blockchain transaction from the app wallet
    // (privileged handler — the wallet seed never leaves it).
    let payoutTxid = order.payoutTxid;
    if (!payoutTxid) {
      const submitted = await ctx.executePrivileged(privileged.piSubmitPayout, {
        destination,
        amountPi: order.sellerNetPi,
        paymentId: payoutId,
      });
      payoutTxid = submitted.txid;
      await db
        .update(schema.orders)
        .set({ payoutTxid, payoutStatus: "submitted", payoutError: null })
        .where(eq(schema.orders.id, orderId));
    }

    // Step 3: complete the payment on the Pi Platform.
    await piApi(ctx, `/payments/${encodeURIComponent(payoutId)}/complete`, {
      method: "POST",
      body: { txid: payoutTxid },
    });
    await db
      .update(schema.orders)
      .set({ payoutStatus: "completed", payoutError: null })
      .where(eq(schema.orders.id, orderId));
  } catch (e) {
    try {
      await db
        .update(schema.orders)
        .set({ payoutStatus: "failed", payoutError: sanitizePaymentError(e) })
        .where(eq(schema.orders.id, orderId));
    } catch {
      /* the order itself is already completed; the payout can be retried */
    }
  }
  ctx.invalidateQueries();
}

const gigShape = z.object({
  id: z.number(),
  sellerName: z.string(),
  sellerPiUid: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  category: categoryEnum,
  pricePi: z.number(),
  deliveryDays: z.number(),
  status: gigStatusEnum,
  createdAt: z.string(),
  avgRating: z.number().nullable(),
  reviewCount: z.number(),
  orderCount: z.number(),
});

const orderShape = z.object({
  id: z.number(),
  gigId: z.number().nullable(),
  gigTitle: z.string(),
  source: z.enum(["gig", "job_request"]),
  jobRequestId: z.number().nullable(),
  messageCount: z.number(),
  sellerName: z.string(),
  sellerPiUid: z.string().nullable(),
  buyerName: z.string(),
  buyerPiUid: z.string().nullable(),
  brief: z.string(),
  amountPi: z.number(),
  commissionPi: z.number(),
  sellerNetPi: z.number(),
  status: orderStatusEnum,
  paymentRef: z.string(),
  paymentStatus: z.enum([
    "simulated",
    "pending",
    "approved",
    "completed",
    "failed",
    "cancelled",
  ]),
  payoutStatus: z
    .enum(["pending", "submitted", "completed", "failed", "simulated"])
    .nullable(),
  payoutError: z.string().nullable(),
  deliveryNote: z.string().nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  hasReview: z.boolean(),
});

const reviewShape = z.object({
  id: z.number(),
  orderId: z.number(),
  gigId: z.number().nullable(),
  buyerName: z.string(),
  buyerPiUid: z.string().nullable(),
  rating: z.number(),
  comment: z.string(),
  createdAt: z.string(),
});

const listGigsResponse = z.object({ gigs: z.array(gigShape) });
const okResponse = z.object({ ok: z.literal(true) });

export const Actions = {
  piLogin: defineAction({
    description:
      "Registers or refreshes a Pi user after real Pi SDK authentication in Pi Browser, verifying the access token against the Pi Platform API when reachable, and returns the user's profile with their gig and order counts.",
    request: piAuthShape,
    response: piUserShape,
    async handler(ctx, args): Promise<z.infer<typeof piUserShape>> {
      const user = await requirePiUser(ctx, args);
      const db = ctx.db<typeof schema>();
      const [gigRows, orderRows] = await Promise.all([
        db.select().from(schema.gigs),
        db.select().from(schema.orders),
      ]);
      ctx.invalidateQueries();
      return {
        id: user.id,
        piUid: user.piUid,
        username: user.username,
        verified: user.verified,
        gigCount: gigRows.filter((g) => g.sellerPiUid === user.piUid).length,
        boughtCount: orderRows.filter((o) => o.buyerPiUid === user.piUid).length,
        soldCount: orderRows.filter((o) => o.sellerPiUid === user.piUid).length,
      };
    },
  }),

  listGigs: defineAction({
    description:
      "Lists marketplace gigs, newest first, optionally filtered by category or a search query, with rating and order aggregates.",
    request: z.object({
      category: categoryEnum.nullable().default(null),
      query: z.string().trim().max(120).default(""),
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: listGigsResponse,
    async handler(ctx, args): Promise<z.infer<typeof listGigsResponse>> {
      const db = ctx.db<typeof schema>();
      const [gigRows, reviewRows, orderRows] = await Promise.all([
        db.select().from(schema.gigs).orderBy(desc(schema.gigs.id)),
        db.select().from(schema.reviews),
        db.select().from(schema.orders),
      ]);
      const q = args.query.toLowerCase();
      const gigs = gigRows
        .filter((g) => (args.category ? g.category === args.category : true))
        .filter(
          (g) =>
            !q ||
            g.title.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q) ||
            g.sellerName.toLowerCase().includes(q),
        )
        .slice(0, args.limit)
        .map((g) => {
          const rs = reviewRows.filter((r) => r.gigId === g.id);
          const os = orderRows.filter((o) => o.gigId === g.id);
          return {
            id: g.id,
            sellerName: g.sellerName,
            sellerPiUid: g.sellerPiUid,
            title: g.title,
            description: g.description,
            category: g.category,
            pricePi: g.pricePi,
            deliveryDays: g.deliveryDays,
            status: g.status,
            createdAt: g.createdAt.toISOString(),
            avgRating: rs.length
              ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10
              : null,
            reviewCount: rs.length,
            orderCount: os.filter((o) => o.status !== "cancelled").length,
          };
        });
      return { gigs };
    },
  }),

  createGig: defineAction({
    description:
      "Publishes a new freelance service (gig) priced in Pi, owned by the authenticated Pi user; the seller name is the user's Pi username.",
    request: z.object({
      auth: piAuthShape,
      title: z.string().trim().min(3, "العنوان قصير جدًا").max(90),
      description: z.string().trim().min(10, "اكتب وصفًا أوضح لخدمتك").max(1200),
      category: categoryEnum,
      pricePi: z.number().positive("السعر لازم يكون أكبر من صفر").max(100000),
      deliveryDays: z.number().int().min(1).max(90),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.gigs)
        .values({
          sellerName: user.username,
          sellerPiUid: user.piUid,
          title: args.title,
          description: args.description,
          category: args.category,
          pricePi: roundPi(args.pricePi),
          deliveryDays: args.deliveryDays,
        })
        .returning({ id: schema.gigs.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createGig: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  setGigStatus: defineAction({
    description:
      "Pauses or reactivates a gig; only the Pi user who owns the gig can change its status (pre-login legacy gigs can be managed by any signed-in user).",
    request: z.object({
      id: z.number().int().positive(),
      status: gigStatusEnum,
      auth: piAuthShape,
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, args.id))
        .limit(1);
      const gig = rows[0];
      if (!gig) throw new Error("الخدمة دي مش موجودة");
      if (gig.sellerPiUid && gig.sellerPiUid !== user.piUid)
        throw new Error("الخدمة دي مش بتاعتك، فمينفعش تغيّر حالتها");
      await db
        .update(schema.gigs)
        .set({ status: args.status })
        .where(eq(schema.gigs.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  createOrder: defineAction({
    description:
      "Simulation fallback used only while the server has no Pi API key configured: creates an order for the authenticated Pi buyer after the labeled Testnet payment simulation; the amount is held in escrow and the 10% commission and seller net are computed server-side. When PI_NETWORK_API_KEY is set, orders go through preparePayment → Pi.createPayment → approvePayment → completePayment instead.",
    request: z.object({
      auth: piAuthShape,
      gigId: z.number().int().positive(),
      brief: z.string().trim().min(5, "اشرح طلبك باختصار").max(1500),
    }),
    response: z.object({
      id: z.number(),
      paymentRef: z.string(),
      amountPi: z.number(),
      commissionPi: z.number(),
      sellerNetPi: z.number(),
    }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const gigRows = await db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, args.gigId))
        .limit(1);
      const gig = gigRows[0];
      if (!gig) throw new Error("الخدمة دي مش موجودة");
      if (gig.status !== "active") throw new Error("الخدمة دي متوقفة مؤقتًا ومش متاحة للطلب");
      if (gig.sellerPiUid && gig.sellerPiUid === user.piUid)
        throw new Error("مينفعش تطلب خدمتك إنت");
      const amountPi = roundPi(gig.pricePi);
      const commissionPi = roundPi(amountPi * COMMISSION_RATE);
      const sellerNetPi = roundPi(amountPi - commissionPi);
      const paymentRef = `testnet-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      const result = await db
        .insert(schema.orders)
        .values({
          gigId: gig.id,
          title: gig.title,
          source: "gig",
          buyerName: user.username,
          buyerPiUid: user.piUid,
          sellerPiUid: gig.sellerPiUid,
          brief: args.brief,
          amountPi,
          commissionPi,
          sellerNetPi,
          paymentRef,
        })
        .returning({ id: schema.orders.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createOrder: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id, paymentRef, amountPi, commissionPi, sellerNetPi };
    },
  }),

  listOrders: defineAction({
    description:
      "Lists all orders with their gig, buyer and seller Pi identities, escrow amounts, status, and whether a review was left, newest first.",
    request: z.object({
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: z.object({ orders: z.array(orderShape) }),
    async handler(ctx, args): Promise<{ orders: z.infer<typeof orderShape>[] }> {
      const db = ctx.db<typeof schema>();
      const [orderRows, gigRows, reviewRows, messageRows] = await Promise.all([
        db
          .select()
          .from(schema.orders)
          .orderBy(desc(schema.orders.id))
          .limit(args.limit),
        db.select().from(schema.gigs),
        db.select().from(schema.reviews),
        db.select().from(schema.messages),
      ]);
      const gigById = new Map(gigRows.map((g) => [g.id, g]));
      const reviewedOrderIds = new Set(reviewRows.map((r) => r.orderId));
      return {
        orders: orderRows.map((o) => {
          const gig = o.gigId != null ? gigById.get(o.gigId) : undefined;
          return {
            id: o.id,
            gigId: o.gigId,
            gigTitle: o.title ?? gig?.title ?? "خدمة محذوفة",
            source: o.source,
            jobRequestId: o.jobRequestId ?? null,
            messageCount: messageRows.filter((m) => m.orderId === o.id).length,
            sellerName: gig?.sellerName ?? "—",
            sellerPiUid: o.sellerPiUid ?? gig?.sellerPiUid ?? null,
            buyerName: o.buyerName,
            buyerPiUid: o.buyerPiUid,
            brief: o.brief,
            amountPi: o.amountPi,
            commissionPi: o.commissionPi,
            sellerNetPi: o.sellerNetPi,
            status: o.status,
            paymentRef: o.paymentRef,
            paymentStatus: o.paymentStatus,
            payoutStatus: o.payoutStatus ?? null,
            payoutError: o.payoutError ?? null,
            deliveryNote: o.deliveryNote,
            createdAt: o.createdAt.toISOString(),
            deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
            completedAt: o.completedAt ? o.completedAt.toISOString() : null,
            hasReview: reviewedOrderIds.has(o.id),
          };
        }),
      };
    },
  }),

  deliverOrder: defineAction({
    description:
      "Marks an order as delivered by the freelancer who owns the gig, with a delivery note.",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
      deliveryNote: z.string().trim().min(1, "اكتب ملحوظة التسليم").max(1000),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.orderId))
        .limit(1);
      const order = rows[0];
      if (!order) throw new Error("الطلب مش موجود");
      if (order.sellerPiUid && order.sellerPiUid !== user.piUid)
        throw new Error("التسليم بيتم من حساب الفريلانسر صاحب الخدمة بس");
      if (order.status !== "awaiting_delivery")
        throw new Error("الطلب ده اتسلّم أو اتقفل قبل كده");
      await db
        .update(schema.orders)
        .set({ status: "delivered", deliveryNote: args.deliveryNote, deliveredAt: new Date() })
        .where(eq(schema.orders.id, args.orderId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  approveOrder: defineAction({
    description:
      "The Pi buyer who placed the order approves delivery, completing it and releasing the escrowed Pi to the freelancer minus the 10% commission via a server-side app_to_user Pi payout (idempotent; payout status is stored on the order).",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
    }),
    response: okResponse,
    privileged: [privileged.piConfig, privileged.piApi, privileged.piSubmitPayout],
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.orderId))
        .limit(1);
      const order = rows[0];
      if (!order) throw new Error("الطلب مش موجود");
      if (order.buyerPiUid && order.buyerPiUid !== user.piUid)
        throw new Error("الاعتماد بيتم من حساب العميل صاحب الطلب بس");
      if (order.status !== "delivered")
        throw new Error("لازم الفريلانسر يسلّم الشغل الأول قبل الاعتماد");
      await db
        .update(schema.orders)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.orders.id, args.orderId));
      // Release the escrow: app_to_user payout to the freelancer (net of the
      // 10% commission). Runs server-side only; failures are recorded on the
      // order's payout status and can be retried — the approval stands.
      await attemptPayout(ctx, args.orderId);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  retryPayout: defineAction({
    description:
      "Retries or resumes the app_to_user Pi payout of a completed order; either the order's buyer or its freelancer can trigger it, and the stored payout identifiers make it safe against duplicates.",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
    }),
    response: okResponse,
    privileged: [privileged.piConfig, privileged.piApi, privileged.piSubmitPayout],
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const { order } = await loadOrderParty(ctx, user, args.orderId);
      if (order.status !== "completed")
        throw new Error("الدفع للفريلانسر بيتم بعد اكتمال الطلب بس");
      await attemptPayout(ctx, args.orderId);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  cancelOrder: defineAction({
    description:
      "Cancels an order that has not been delivered yet; only the Pi buyer who placed it can cancel, and the escrowed Pi is marked refunded.",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.orderId))
        .limit(1);
      const order = rows[0];
      if (!order) throw new Error("الطلب مش موجود");
      if (order.buyerPiUid && order.buyerPiUid !== user.piUid)
        throw new Error("الإلغاء بيتم من حساب العميل صاحب الطلب بس");
      if (order.status !== "awaiting_delivery")
        throw new Error("الطلب ده مينفعش يتلغي دلوقتي");
      await db
        .update(schema.orders)
        .set({ status: "cancelled" })
        .where(eq(schema.orders.id, args.orderId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addReview: defineAction({
    description:
      "Adds the Pi buyer's star rating and comment for their own completed order.",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1, "اكتب تعليقك").max(600),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, args.orderId))
        .limit(1);
      const order = rows[0];
      if (!order) throw new Error("الطلب مش موجود");
      if (order.buyerPiUid && order.buyerPiUid !== user.piUid)
        throw new Error("التقييم بيتم من حساب العميل صاحب الطلب بس");
      if (order.status !== "completed")
        throw new Error("التقييم بيكون بعد اكتمال الطلب");
      const existing = await db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.orderId, args.orderId))
        .limit(1);
      if (existing[0]) throw new Error("إنت قيّمت الطلب ده قبل كده");
      const result = await db
        .insert(schema.reviews)
        .values({
          orderId: order.id,
          gigId: order.gigId,
          buyerName: user.username,
          buyerPiUid: user.piUid,
          rating: args.rating,
          comment: args.comment,
        })
        .returning({ id: schema.reviews.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addReview: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  listReviews: defineAction({
    description: "Lists reviews for one gig, newest first.",
    request: z.object({ gigId: z.number().int().positive() }),
    response: z.object({ reviews: z.array(reviewShape) }),
    async handler(ctx, args): Promise<{ reviews: z.infer<typeof reviewShape>[] }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.gigId, args.gigId))
        .orderBy(desc(schema.reviews.id))
        .limit(50);
      return {
        reviews: rows.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          gigId: r.gigId,
          buyerName: r.buyerName,
          buyerPiUid: r.buyerPiUid,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  listMessages: defineAction({
    description:
      "Lists the chat messages of one order; only the order's buyer and freelancer (verified Pi identities) can read them.",
    request: z.object({ auth: piAuthShape, orderId: z.number().int().positive() }),
    response: z.object({
      messages: z.array(
        z.object({
          id: z.number(),
          senderPiUid: z.string(),
          senderName: z.string(),
          mine: z.boolean(),
          body: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      await loadOrderParty(ctx, user, args.orderId);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.orderId, args.orderId))
        .orderBy(schema.messages.id)
        .limit(200);
      return {
        messages: rows.map((m) => ({
          id: m.id,
          senderPiUid: m.senderPiUid,
          senderName: m.senderName,
          mine: m.senderPiUid === user.piUid,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  }),

  sendMessage: defineAction({
    description:
      "Sends a text message in an order's chat; only the order's buyer or freelancer can post.",
    request: z.object({
      auth: piAuthShape,
      orderId: z.number().int().positive(),
      body: z.string().trim().min(1, "اكتب رسالتك").max(2000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      await loadOrderParty(ctx, user, args.orderId);
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.messages)
        .values({
          orderId: args.orderId,
          senderPiUid: user.piUid,
          senderName: user.username,
          body: args.body,
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("sendMessage: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  getFreelancerProfile: defineAction({
    description:
      "Returns a freelancer's public profile by Pi uid: bio, portfolio gallery, their gigs, rating aggregates, completed order count, recent reviews, and whether they earned the verified badge.",
    request: z.object({ piUid: z.string().trim().min(1).max(128) }),
    response: z.object({
      found: z.boolean(),
      username: z.string().nullable(),
      piVerified: z.boolean(),
      bio: z.string().nullable(),
      city: z.enum(schema.CITY_KEYS).nullable(),
      joinedAt: z.string().nullable(),
      completedCount: z.number(),
      totalOrderCount: z.number(),
      avgRating: z.number().nullable(),
      reviewCount: z.number(),
      verifiedBadge: z.boolean(),
      gigs: z.array(gigShape),
      portfolio: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
          description: z.string(),
          linkUrl: z.string().nullable(),
          category: categoryEnum.nullable(),
          createdAt: z.string(),
        }),
      ),
      reviews: z.array(reviewShape),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [userRows, gigRows, orderRows, reviewRows, portfolioRows] =
        await Promise.all([
          db
            .select()
            .from(schema.users)
            .where(eq(schema.users.piUid, args.piUid))
            .limit(1),
          db
            .select()
            .from(schema.gigs)
            .where(eq(schema.gigs.sellerPiUid, args.piUid))
            .orderBy(desc(schema.gigs.id)),
          db.select().from(schema.orders),
          db.select().from(schema.reviews),
          db
            .select()
            .from(schema.portfolioItems)
            .where(eq(schema.portfolioItems.ownerPiUid, args.piUid))
            .orderBy(desc(schema.portfolioItems.id)),
        ]);
      const gigIds = new Set(gigRows.map((g) => g.id));
      const mySoldOrderIds = new Set(
        orderRows.filter((o) => o.sellerPiUid === args.piUid).map((o) => o.id),
      );
      const myReviews = reviewRows
        .filter(
          (r) =>
            (r.gigId != null && gigIds.has(r.gigId)) || mySoldOrderIds.has(r.orderId),
        )
        .sort((a, b) => b.id - a.id);
      const myOrders = orderRows.filter((o) => o.sellerPiUid === args.piUid);
      const completed = myOrders.filter((o) => o.status === "completed");
      const u = userRows[0];
      return {
        found: !!u || gigRows.length > 0,
        username: u?.username ?? gigRows[0]?.sellerName ?? null,
        piVerified: u ? u.verified === 1 : false,
        bio: u?.bio ?? null,
        city: u?.city ?? null,
        joinedAt: u ? u.createdAt.toISOString() : null,
        completedCount: completed.length,
        totalOrderCount: myOrders.filter((o) => o.status !== "cancelled").length,
        avgRating: myReviews.length
          ? Math.round(
              (myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length) * 10,
            ) / 10
          : null,
        reviewCount: myReviews.length,
        verifiedBadge: completed.length >= VERIFIED_BADGE_MIN_COMPLETED,
        gigs: gigRows.map((g) => {
          const rs = myReviews.filter((r) => r.gigId === g.id);
          const os = orderRows.filter((o) => o.gigId === g.id);
          return {
            id: g.id,
            sellerName: g.sellerName,
            sellerPiUid: g.sellerPiUid,
            title: g.title,
            description: g.description,
            category: g.category,
            pricePi: g.pricePi,
            deliveryDays: g.deliveryDays,
            status: g.status,
            createdAt: g.createdAt.toISOString(),
            avgRating: rs.length
              ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10
              : null,
            reviewCount: rs.length,
            orderCount: os.filter((o) => o.status !== "cancelled").length,
          };
        }),
        portfolio: portfolioRows.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          linkUrl: p.linkUrl,
          category: p.category ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        reviews: myReviews.slice(0, 20).map((r) => ({
          id: r.id,
          orderId: r.orderId,
          gigId: r.gigId,
          buyerName: r.buyerName,
          buyerPiUid: r.buyerPiUid,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  updateProfile: defineAction({
    description:
      "Updates the signed-in Pi user's public freelancer bio and the city they picked for the explore map.",
    request: z.object({
      auth: piAuthShape,
      bio: z.string().trim().max(600),
      city: z.enum(schema.CITY_KEYS).nullable().default(null),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.users)
        .set({ bio: args.bio || null, city: args.city })
        .where(eq(schema.users.id, user.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listMapGigs: defineAction({
    description:
      "Lists active gigs whose freelancer picked a city on their profile, for the explore map: gig, freelancer, Pi price and city key.",
    request: z.object({}),
    response: z.object({
      places: z.array(
        z.object({
          gigId: z.number(),
          title: z.string(),
          category: categoryEnum,
          pricePi: z.number(),
          deliveryDays: z.number(),
          sellerName: z.string(),
          sellerPiUid: z.string(),
          city: z.enum(schema.CITY_KEYS),
          avgRating: z.number().nullable(),
          reviewCount: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [gigRows, userRows, reviewRows] = await Promise.all([
        db.select().from(schema.gigs).orderBy(desc(schema.gigs.id)),
        db.select().from(schema.users),
        db.select().from(schema.reviews),
      ]);
      const cityByUid = new Map(
        userRows.filter((u) => u.city).map((u) => [u.piUid, u.city!]),
      );
      return {
        places: gigRows
          .filter((g) => g.status === "active" && g.sellerPiUid)
          .flatMap((g) => {
            const city = cityByUid.get(g.sellerPiUid!);
            if (!city) return [];
            const rs = reviewRows.filter((r) => r.gigId === g.id);
            return [
              {
                gigId: g.id,
                title: g.title,
                category: g.category,
                pricePi: g.pricePi,
                deliveryDays: g.deliveryDays,
                sellerName: g.sellerName,
                sellerPiUid: g.sellerPiUid!,
                city,
                avgRating: rs.length
                  ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10
                  : null,
                reviewCount: rs.length,
              },
            ];
          }),
      };
    },
  }),

  addPortfolioItem: defineAction({
    description:
      "Adds a work sample to the signed-in freelancer's portfolio gallery (title, description, optional external link and category).",
    request: z.object({
      auth: piAuthShape,
      title: z.string().trim().min(2, "عنوان العمل قصير جدًا").max(90),
      description: z.string().trim().min(5, "اكتب وصفًا مختصرًا للعمل").max(500),
      linkUrl: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || /^https?:\/\//i.test(v), {
          message: "الرابط لازم يبدأ بـ http أو https",
        })
        .default(""),
      category: categoryEnum.nullable().default(null),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.portfolioItems)
        .values({
          ownerPiUid: user.piUid,
          title: args.title,
          description: args.description,
          linkUrl: args.linkUrl ? args.linkUrl : null,
          category: args.category,
        })
        .returning({ id: schema.portfolioItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPortfolioItem: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deletePortfolioItem: defineAction({
    description: "Deletes one of the signed-in freelancer's own portfolio items.",
    request: z.object({ auth: piAuthShape, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.portfolioItems)
        .where(eq(schema.portfolioItems.id, args.id))
        .limit(1);
      const item = rows[0];
      if (!item) throw new Error("العمل ده مش موجود");
      if (item.ownerPiUid !== user.piUid)
        throw new Error("العمل ده مش بتاعك");
      await db
        .delete(schema.portfolioItems)
        .where(eq(schema.portfolioItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listJobRequests: defineAction({
    description:
      "Lists client job requests (reverse marketplace), newest first, with the count of offers on each.",
    request: z.object({
      status: z.enum(["open", "awarded", "cancelled"]).nullable().default(null),
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: z.object({
      requests: z.array(
        z.object({
          id: z.number(),
          buyerName: z.string(),
          buyerPiUid: z.string().nullable(),
          title: z.string(),
          description: z.string(),
          category: categoryEnum,
          budgetPi: z.number(),
          durationDays: z.number(),
          status: z.enum(["open", "awarded", "cancelled"]),
          offerCount: z.number(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [reqRows, offerRows] = await Promise.all([
        db
          .select()
          .from(schema.jobRequests)
          .orderBy(desc(schema.jobRequests.id))
          .limit(args.limit),
        db.select().from(schema.offers),
      ]);
      return {
        requests: reqRows
          .filter((r) => (args.status ? r.status === args.status : true))
          .map((r) => ({
            id: r.id,
            buyerName: r.buyerName,
            buyerPiUid: r.buyerPiUid,
            title: r.title,
            description: r.description,
            category: r.category,
            budgetPi: r.budgetPi,
            durationDays: r.durationDays,
            status: r.status,
            offerCount: offerRows.filter((o) => o.jobRequestId === r.id).length,
            createdAt: r.createdAt.toISOString(),
          })),
      };
    },
  }),

  createJobRequest: defineAction({
    description:
      "Publishes a client job request with a Pi budget and duration, open for freelancer offers.",
    request: z.object({
      auth: piAuthShape,
      title: z.string().trim().min(3, "العنوان قصير جدًا").max(90),
      description: z.string().trim().min(10, "اكتب وصفًا أوضح لطلب الشغل").max(1500),
      category: categoryEnum,
      budgetPi: z.number().positive("الميزانية لازم تكون أكبر من صفر").max(100000),
      durationDays: z.number().int().min(1).max(180),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.jobRequests)
        .values({
          buyerName: user.username,
          buyerPiUid: user.piUid,
          title: args.title,
          description: args.description,
          category: args.category,
          budgetPi: roundPi(args.budgetPi),
          durationDays: args.durationDays,
        })
        .returning({ id: schema.jobRequests.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createJobRequest: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  cancelJobRequest: defineAction({
    description:
      "Cancels an open job request; only its owner client can cancel, and only while it is still open.",
    request: z.object({ auth: piAuthShape, id: z.number().int().positive() }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.jobRequests)
        .where(eq(schema.jobRequests.id, args.id))
        .limit(1);
      const req = rows[0];
      if (!req) throw new Error("طلب الشغل مش موجود");
      if (req.buyerPiUid && req.buyerPiUid !== user.piUid)
        throw new Error("طلب الشغل ده مش بتاعك");
      if (req.status !== "open") throw new Error("الطلب ده مش مفتوح دلوقتي");
      await db
        .update(schema.jobRequests)
        .set({ status: "cancelled" })
        .where(eq(schema.jobRequests.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listOffers: defineAction({
    description: "Lists the offers submitted on one job request, newest first.",
    request: z.object({ jobRequestId: z.number().int().positive() }),
    response: z.object({
      offers: z.array(
        z.object({
          id: z.number(),
          jobRequestId: z.number(),
          sellerName: z.string(),
          sellerPiUid: z.string().nullable(),
          pricePi: z.number(),
          deliveryDays: z.number(),
          message: z.string(),
          status: z.enum(["pending", "accepted", "rejected"]),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.offers)
        .where(eq(schema.offers.jobRequestId, args.jobRequestId))
        .orderBy(desc(schema.offers.id))
        .limit(100);
      return {
        offers: rows.map((o) => ({
          id: o.id,
          jobRequestId: o.jobRequestId,
          sellerName: o.sellerName,
          sellerPiUid: o.sellerPiUid,
          pricePi: o.pricePi,
          deliveryDays: o.deliveryDays,
          message: o.message,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
      };
    },
  }),

  createOffer: defineAction({
    description:
      "Submits a freelancer's priced offer (Pi price and delivery days) on an open job request.",
    request: z.object({
      auth: piAuthShape,
      jobRequestId: z.number().int().positive(),
      pricePi: z.number().positive("السعر لازم يكون أكبر من صفر").max(100000),
      deliveryDays: z.number().int().min(1).max(180),
      message: z.string().trim().min(5, "اكتب رسالة مختصرة للعميل").max(800),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const reqRows = await db
        .select()
        .from(schema.jobRequests)
        .where(eq(schema.jobRequests.id, args.jobRequestId))
        .limit(1);
      const req = reqRows[0];
      if (!req) throw new Error("طلب الشغل مش موجود");
      if (req.status !== "open") throw new Error("طلب الشغل ده اتقفل ومش بيقبل عروض");
      if (req.buyerPiUid && req.buyerPiUid === user.piUid)
        throw new Error("مينفعش تقدّم عرض على طلب الشغل بتاعك");
      const result = await db
        .insert(schema.offers)
        .values({
          jobRequestId: req.id,
          sellerName: user.username,
          sellerPiUid: user.piUid,
          pricePi: roundPi(args.pricePi),
          deliveryDays: args.deliveryDays,
          message: args.message,
          status: "pending",
        })
        .returning({ id: schema.offers.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createOffer: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  acceptOffer: defineAction({
    description:
      "Simulation fallback used only while the server has no Pi API key configured: the job request's owner accepts an offer after the labeled Testnet payment simulation, creating an escrow order at the offer price with the same 10% commission, marking the request awarded and the other offers rejected. When PI_NETWORK_API_KEY is set, acceptance goes through the real Pi payment actions instead.",
    request: z.object({ auth: piAuthShape, offerId: z.number().int().positive() }),
    response: z.object({
      orderId: z.number(),
      paymentRef: z.string(),
      amountPi: z.number(),
      commissionPi: z.number(),
      sellerNetPi: z.number(),
    }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const offerRows = await db
        .select()
        .from(schema.offers)
        .where(eq(schema.offers.id, args.offerId))
        .limit(1);
      const offer = offerRows[0];
      if (!offer) throw new Error("العرض مش موجود");
      if (offer.status !== "pending") throw new Error("العرض ده اتحسم قبل كده");
      const reqRows = await db
        .select()
        .from(schema.jobRequests)
        .where(eq(schema.jobRequests.id, offer.jobRequestId))
        .limit(1);
      const req = reqRows[0];
      if (!req) throw new Error("طلب الشغل مش موجود");
      if (req.buyerPiUid && req.buyerPiUid !== user.piUid)
        throw new Error("قبول العرض بيتم من حساب العميل صاحب طلب الشغل بس");
      if (req.status !== "open") throw new Error("طلب الشغل ده اتقفل قبل كده");
      const amountPi = roundPi(offer.pricePi);
      const commissionPi = roundPi(amountPi * COMMISSION_RATE);
      const sellerNetPi = roundPi(amountPi - commissionPi);
      const paymentRef = `testnet-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      const allOffers = await db
        .select()
        .from(schema.offers)
        .where(eq(schema.offers.jobRequestId, req.id));
      const statements: BatchItem<"sqlite">[] = [
        db
          .insert(schema.orders)
          .values({
            gigId: null,
            title: req.title,
            source: "job_request",
            jobRequestId: req.id,
            buyerName: user.username,
            buyerPiUid: user.piUid,
            sellerPiUid: offer.sellerPiUid,
            brief: req.description,
            amountPi,
            commissionPi,
            sellerNetPi,
            paymentRef,
          })
          .returning({ id: schema.orders.id }),
        db
          .update(schema.offers)
          .set({ status: "accepted" })
          .where(eq(schema.offers.id, offer.id)),
        ...allOffers
          .filter((o) => o.id !== offer.id && o.status === "pending")
          .map((o) =>
            db
              .update(schema.offers)
              .set({ status: "rejected" })
              .where(eq(schema.offers.id, o.id)),
          ),
        db
          .update(schema.jobRequests)
          .set({ status: "awarded" })
          .where(eq(schema.jobRequests.id, req.id)),
      ];
      const [first, ...rest] = statements;
      if (!first) throw new Error("acceptOffer: no statements");
      const results = await db.batch([first, ...rest]);
      const inserted = (results[0] as { id: number }[])[0];
      if (!inserted) throw new Error("acceptOffer: order insert returned no rows");
      ctx.invalidateQueries();
      return {
        orderId: inserted.id,
        paymentRef,
        amountPi,
        commissionPi,
        sellerNetPi,
      };
    },
  }),

  getWallet: defineAction({
    description:
      "Returns the signed-in user's wallet dashboard: as a freelancer their released earnings, commission deducted, escrow pending and completed/pending counts; as a client their spending and order counts. All amounts in Pi.",
    request: z.object({ auth: piAuthShape }),
    response: z.object({
      earnedPi: z.number(),
      commissionPaidPi: z.number(),
      pendingNetPi: z.number(),
      pendingGrossPi: z.number(),
      payoutPendingPi: z.number(),
      soldCompleted: z.number(),
      soldPending: z.number(),
      spentPi: z.number(),
      escrowPi: z.number(),
      boughtCompleted: z.number(),
      boughtPending: z.number(),
      walletAddress: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const userRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      const orderRows = await db.select().from(schema.orders);
      const sold = orderRows.filter((o) => o.sellerPiUid === user.piUid);
      const bought = orderRows.filter((o) => o.buyerPiUid === user.piUid);
      const soldDone = sold.filter((o) => o.status === "completed");
      const soldPending = sold.filter(
        (o) => o.status === "awaiting_delivery" || o.status === "delivered",
      );
      const boughtDone = bought.filter((o) => o.status === "completed");
      const boughtPending = bought.filter(
        (o) => o.status === "awaiting_delivery" || o.status === "delivered",
      );
      return {
        earnedPi: roundPi(soldDone.reduce((s, o) => s + o.sellerNetPi, 0)),
        payoutPendingPi: roundPi(
          soldDone
            .filter(
              (o) =>
                o.payoutStatus === "pending" ||
                o.payoutStatus === "submitted" ||
                o.payoutStatus === "failed",
            )
            .reduce((s, o) => s + o.sellerNetPi, 0),
        ),
        commissionPaidPi: roundPi(soldDone.reduce((s, o) => s + o.commissionPi, 0)),
        pendingNetPi: roundPi(soldPending.reduce((s, o) => s + o.sellerNetPi, 0)),
        pendingGrossPi: roundPi(soldPending.reduce((s, o) => s + o.amountPi, 0)),
        soldCompleted: soldDone.length,
        soldPending: soldPending.length,
        spentPi: roundPi(boughtDone.reduce((s, o) => s + o.amountPi, 0)),
        escrowPi: roundPi(boughtPending.reduce((s, o) => s + o.amountPi, 0)),
        boughtCompleted: boughtDone.length,
        boughtPending: boughtPending.length,
        walletAddress: userRows[0]?.walletAddress ?? null,
      };
    },
  }),

  setWalletAddress: defineAction({
    description:
      "Saves the signed-in user's own Pi wallet address for app_to_user payouts, for when Pi did not return it via the wallet_address scope.",
    request: z.object({
      auth: piAuthShape,
      walletAddress: z
        .string()
        .trim()
        .regex(/^G[A-Z2-7]{55}$/, "عنوان المحفظة مش صحيح — لازم يبدأ بـ G ويكون 56 حرف"),
    }),
    response: okResponse,
    async handler(ctx, args) {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.users)
        .set({ walletAddress: args.walletAddress })
        .where(eq(schema.users.id, user.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getPaymentConfig: defineAction({
    description:
      "Tells the client whether real Pi payments are active on the server (the developer configured PI_NETWORK_API_KEY, and PI_WALLET_SEED for payouts) without ever exposing the secret values; when inactive, the UI keeps the labeled Testnet simulation.",
    request: z.object({}),
    response: z.object({
      realPayments: z.boolean(),
      realPayouts: z.boolean(),
    }),
    privileged: [privileged.piConfig],
    async handler(ctx): Promise<{ realPayments: boolean; realPayouts: boolean }> {
      const cfg = await piConfig(ctx);
      return {
        realPayments: cfg.paymentsEnabled,
        realPayouts: cfg.payoutsEnabled,
      };
    },
  }),

  preparePayment: defineAction({
    description:
      "Creates a server-side payment intent before a real user_to_app Pi payment: validates the gig or offer, computes the amount, 10% commission and seller net server-side, and returns the amount, memo and metadata the client passes to Pi.createPayment.",
    request: z.object({
      auth: piAuthShape,
      kind: z.enum(["gig", "offer"]),
      gigId: z.number().int().positive().nullable().default(null),
      offerId: z.number().int().positive().nullable().default(null),
      brief: z.string().trim().max(1500).default(""),
    }),
    response: z.object({
      intentId: z.number(),
      amountPi: z.number(),
      commissionPi: z.number(),
      sellerNetPi: z.number(),
      memo: z.string(),
    }),
    privileged: [privileged.piConfig],
    async handler(ctx, args) {
      const cfg = await piConfig(ctx);
      if (!cfg.paymentsEnabled)
        throw new Error(
          "الدفع الحقيقي بـ Pi مش مفعّل على السيرفر لسه — المطوّر محتاج يحط PI_NETWORK_API_KEY في إعدادات أسرار السيرفر.",
        );
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      let amountPi = 0;
      let sellerPiUid: string | null = null;
      let gigId: number | null = null;
      let offerId: number | null = null;
      let brief = "";
      let memoTitle = "";
      if (args.kind === "gig") {
        if (args.gigId == null) throw new Error("اختار الخدمة الأول");
        if (args.brief.trim().length < 5) throw new Error("اشرح طلبك باختصار");
        const gigRows = await db
          .select()
          .from(schema.gigs)
          .where(eq(schema.gigs.id, args.gigId))
          .limit(1);
        const gig = gigRows[0];
        if (!gig) throw new Error("الخدمة دي مش موجودة");
        if (gig.status !== "active")
          throw new Error("الخدمة دي متوقفة مؤقتًا ومش متاحة للطلب");
        if (gig.sellerPiUid && gig.sellerPiUid === user.piUid)
          throw new Error("مينفعش تطلب خدمتك إنت");
        amountPi = roundPi(gig.pricePi);
        sellerPiUid = gig.sellerPiUid;
        gigId = gig.id;
        brief = args.brief.trim();
        memoTitle = gig.title;
      } else {
        if (args.offerId == null) throw new Error("اختار العرض الأول");
        const offerRows = await db
          .select()
          .from(schema.offers)
          .where(eq(schema.offers.id, args.offerId))
          .limit(1);
        const offer = offerRows[0];
        if (!offer) throw new Error("العرض مش موجود");
        if (offer.status !== "pending") throw new Error("العرض ده اتحسم قبل كده");
        const reqRows = await db
          .select()
          .from(schema.jobRequests)
          .where(eq(schema.jobRequests.id, offer.jobRequestId))
          .limit(1);
        const req = reqRows[0];
        if (!req) throw new Error("طلب الشغل مش موجود");
        if (req.buyerPiUid && req.buyerPiUid !== user.piUid)
          throw new Error("قبول العرض بيتم من حساب العميل صاحب طلب الشغل بس");
        if (req.status !== "open") throw new Error("طلب الشغل ده اتقفل قبل كده");
        amountPi = roundPi(offer.pricePi);
        sellerPiUid = offer.sellerPiUid;
        offerId = offer.id;
        brief = req.description;
        memoTitle = req.title;
      }
      const commissionPi = roundPi(amountPi * COMMISSION_RATE);
      const sellerNetPi = roundPi(amountPi - commissionPi);
      const inserted = await db
        .insert(schema.paymentIntents)
        .values({
          kind: args.kind,
          buyerPiUid: user.piUid,
          buyerName: user.username,
          gigId,
          offerId,
          brief,
          amountPi,
          commissionPi,
          sellerNetPi,
          sellerPiUid,
        })
        .returning({ id: schema.paymentIntents.id });
      const row = inserted[0];
      if (!row) throw new Error("preparePayment: insert returned no rows");
      return {
        intentId: row.id,
        amountPi,
        commissionPi,
        sellerNetPi,
        memo: `PiGigz: ${memoTitle}`.slice(0, 120),
      };
    },
  }),

  approvePayment: defineAction({
    description:
      "Server approval step of a real user_to_app Pi payment (called from Pi.createPayment's onReadyForServerApproval): verifies the payment's amount, buyer identity and intent metadata against the Pi Platform API, then calls POST /v2/payments/{id}/approve with the server API key.",
    request: z.object({
      auth: piAuthShape,
      intentId: z.number().int().positive(),
      paymentId: z.string().trim().min(1).max(128),
    }),
    response: okResponse,
    privileged: [privileged.piApi],
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      // Timeout fix (2026-11-26): the three reads below are independent —
      // verify the user token (Pi v2/me, up to 8s), load the payment intent
      // from the DB, and fetch the payment from Pi (up to 15s). Running them
      // one after another, then POST /approve (up to 15s), cost up to ~38s
      // against the 60s function limit and the call died before answering
      // (client saw only the generic SDK error). Run them together instead.
      const db = ctx.db<typeof schema>();
      const [user, rows, payment] = await Promise.all([
        requirePiUser(ctx, args.auth),
        db
          .select()
          .from(schema.paymentIntents)
          .where(eq(schema.paymentIntents.id, args.intentId))
          .limit(1),
        getPiPayment(ctx, args.paymentId),
      ]);
      const intent = rows[0];
      if (!intent) throw new Error("نية الدفع مش موجودة");
      if (intent.buyerPiUid !== user.piUid)
        throw new Error("الدفعة دي مش بتاعة حسابك");
      if (intent.status === "completed")
        throw new Error("الدفعة دي اكتملت واتحوّلت لطلب قبل كده");
      if (intent.piPaymentId && intent.piPaymentId !== args.paymentId)
        throw new Error("معرّف الدفعة مش متطابق مع نية الدفع");

      if (payment.direction !== "user_to_app")
        throw new Error("اتجاه الدفعة مش من العميل للتطبيق");
      if (payment.user_uid !== user.piUid)
        throw new Error("هوية الدافع في Pi مش متطابقة مع حسابك");
      if (roundPi(payment.amount) !== intent.amountPi)
        throw new Error("مبلغ الدفعة في Pi مش متطابق مع مبلغ الطلب");
      const metaIntent = payment.metadata?.intentId;
      if (metaIntent != null && Number(metaIntent) !== intent.id)
        throw new Error("بيانات الدفعة في Pi مش متطابقة مع الطلب");
      if (payment.status.cancelled || payment.status.user_cancelled)
        throw new Error("الدفعة اتلغت من محفظة Pi");

      if (!payment.status.developer_approved) {
        await piApi(ctx, `/payments/${encodeURIComponent(args.paymentId)}/approve`, {
          method: "POST",
        });
      }
      await db
        .update(schema.paymentIntents)
        .set({ status: "approved", piPaymentId: args.paymentId })
        .where(eq(schema.paymentIntents.id, intent.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  completePayment: defineAction({
    description:
      "Server completion step of a real user_to_app Pi payment (called from Pi.createPayment's onReadyForServerCompletion): verifies the payment and its txid, calls POST /v2/payments/{id}/complete with the server API key, then creates the escrow order exactly once from the payment intent.",
    request: z.object({
      auth: piAuthShape,
      intentId: z.number().int().positive(),
      paymentId: z.string().trim().min(1).max(128),
      txid: z.string().trim().min(8).max(128),
    }),
    response: z.object({
      orderId: z.number(),
      paymentRef: z.string(),
      amountPi: z.number(),
      commissionPi: z.number(),
      sellerNetPi: z.number(),
    }),
    privileged: [privileged.piApi],
    async handler(ctx, args) {
      // Timeout fix (2026-11-26): same as approvePayment — verify the user
      // token, load the payment intent, and fetch the payment from Pi in
      // parallel instead of one after another, so the call answers well
      // inside the 60s function limit.
      const db = ctx.db<typeof schema>();
      const [user, rows, payment] = await Promise.all([
        requirePiUser(ctx, args.auth),
        db
          .select()
          .from(schema.paymentIntents)
          .where(eq(schema.paymentIntents.id, args.intentId))
          .limit(1),
        getPiPayment(ctx, args.paymentId),
      ]);
      const intent = rows[0];
      if (!intent) throw new Error("نية الدفع مش موجودة");
      if (intent.buyerPiUid !== user.piUid)
        throw new Error("الدفعة دي مش بتاعة حسابك");
      if (intent.orderId != null) {
        // Already fulfilled (double callback / retry): return the same order.
        return {
          orderId: intent.orderId,
          paymentRef: intent.piPaymentId ?? args.paymentId,
          amountPi: intent.amountPi,
          commissionPi: intent.commissionPi,
          sellerNetPi: intent.sellerNetPi,
        };
      }
      if (intent.piPaymentId && intent.piPaymentId !== args.paymentId)
        throw new Error("معرّف الدفعة مش متطابق مع نية الدفع");

      if (payment.user_uid !== user.piUid)
        throw new Error("هوية الدافع في Pi مش متطابقة مع حسابك");
      if (roundPi(payment.amount) !== intent.amountPi)
        throw new Error("مبلغ الدفعة في Pi مش متطابق مع مبلغ الطلب");
      if (!payment.status.developer_approved && !payment.status.developer_completed)
        throw new Error("الدفعة لسه متوافقش عليها من السيرفر");
      if (payment.transaction?.txid && payment.transaction.txid !== args.txid)
        throw new Error("رقم عملية البلوكتشين مش متطابق مع الدفعة");

      if (!payment.status.developer_completed) {
        await piApi(ctx, `/payments/${encodeURIComponent(args.paymentId)}/complete`, {
          method: "POST",
          body: { txid: args.txid },
        });
      }
      const freshRows = await db
        .select()
        .from(schema.paymentIntents)
        .where(eq(schema.paymentIntents.id, intent.id))
        .limit(1);
      const fresh = freshRows[0] ?? intent;
      const ready: PaymentIntentRow = {
        ...fresh,
        status: "approved",
        piPaymentId: args.paymentId,
        piTxid: args.txid,
      };
      await db
        .update(schema.paymentIntents)
        .set({ piTxid: args.txid })
        .where(eq(schema.paymentIntents.id, intent.id));
      const { orderId } = await fulfillIntent(ctx, ready);
      ctx.invalidateQueries();
      return {
        orderId,
        paymentRef: args.paymentId,
        amountPi: intent.amountPi,
        commissionPi: intent.commissionPi,
        sellerNetPi: intent.sellerNetPi,
      };
    },
  }),

  failPayment: defineAction({
    description:
      "Marks a payment intent failed or cancelled when Pi.createPayment is cancelled or errors on the client; an already server-approved intent is left untouched so the incomplete-payment resolver can still finish it.",
    request: z.object({
      auth: piAuthShape,
      intentId: z.number().int().positive(),
      paymentId: z.string().trim().max(128).nullable().default(null),
      reason: z.enum(["cancelled", "error"]),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const user = await requirePiUser(ctx, args.auth);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.paymentIntents)
        .where(eq(schema.paymentIntents.id, args.intentId))
        .limit(1);
      const intent = rows[0];
      if (!intent) throw new Error("نية الدفع مش موجودة");
      if (intent.buyerPiUid !== user.piUid)
        throw new Error("الدفعة دي مش بتاعة حسابك");
      if (intent.status === "awaiting_payment") {
        await db
          .update(schema.paymentIntents)
          .set({
            status: args.reason === "cancelled" ? "cancelled" : "failed",
            piPaymentId: args.paymentId ?? intent.piPaymentId,
          })
          .where(eq(schema.paymentIntents.id, intent.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  resolveIncompletePayment: defineAction({
    description:
      "Resolves an incomplete Pi payment reported by Pi.authenticate's onIncompletePaymentFound: completes it on the Pi Platform when it was approved and has a transaction (creating its escrow order if it maps to a payment intent), otherwise cancels it server-side.",
    request: z.object({
      auth: piAuthShape,
      paymentId: z.string().trim().min(1).max(128),
    }),
    response: z.object({
      ok: z.literal(true),
      resolution: z.enum(["completed", "cancelled", "already_done", "not_configured"]),
      orderId: z.number().nullable(),
    }),
    privileged: [privileged.piConfig, privileged.piApi],
    async handler(
      ctx,
      args,
    ): Promise<{
      ok: true;
      resolution: "completed" | "cancelled" | "already_done" | "not_configured";
      orderId: number | null;
    }> {
      const user = await requirePiUser(ctx, args.auth);
      const cfg = await piConfig(ctx);
      if (!cfg.paymentsEnabled)
        return { ok: true, resolution: "not_configured", orderId: null };
      const payment = await getPiPayment(ctx, args.paymentId);
      if (payment.user_uid !== user.piUid)
        throw new Error("الدفعة المعلّقة دي مش بتاعة حسابك");
      if (payment.status.developer_completed)
        return { ok: true, resolution: "already_done", orderId: null };
      if (payment.status.cancelled || payment.status.user_cancelled)
        return { ok: true, resolution: "already_done", orderId: null };

      const db = ctx.db<typeof schema>();
      const intentRows = await db
        .select()
        .from(schema.paymentIntents)
        .where(eq(schema.paymentIntents.piPaymentId, args.paymentId))
        .limit(1);
      const intent = intentRows[0];

      if (payment.status.developer_approved && payment.transaction?.txid) {
        await piApi(ctx, `/payments/${encodeURIComponent(args.paymentId)}/complete`, {
          method: "POST",
          body: { txid: payment.transaction.txid },
        });
        let orderId: number | null = null;
        if (intent && intent.buyerPiUid === user.piUid) {
          const ready: PaymentIntentRow = {
            ...intent,
            piTxid: payment.transaction.txid,
          };
          const done = await fulfillIntent(ctx, ready);
          orderId = done.orderId;
        }
        ctx.invalidateQueries();
        return { ok: true, resolution: "completed", orderId };
      }
      await piApi(ctx, `/payments/${encodeURIComponent(args.paymentId)}/cancel`, {
        method: "POST",
      });
      if (intent && intent.status !== "completed") {
        await db
          .update(schema.paymentIntents)
          .set({ status: "cancelled" })
          .where(eq(schema.paymentIntents.id, intent.id));
      }
      ctx.invalidateQueries();
      return { ok: true, resolution: "cancelled", orderId: null };
    },
  }),

  getStats: defineAction({
    description:
      "Returns marketplace totals: active gigs, orders, completed orders, completed Pi volume, and commission earned.",
    request: z.object({}),
    response: z.object({
      gigCount: z.number(),
      orderCount: z.number(),
      completedCount: z.number(),
      volumePi: z.number(),
      commissionPi: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [gigRows, orderRows] = await Promise.all([
        db.select().from(schema.gigs),
        db.select().from(schema.orders),
      ]);
      const completed = orderRows.filter((o) => o.status === "completed");
      return {
        gigCount: gigRows.filter((g) => g.status === "active").length,
        orderCount: orderRows.filter((o) => o.status !== "cancelled").length,
        completedCount: completed.length,
        volumePi: roundPi(completed.reduce((s, o) => s + o.amountPi, 0)),
        commissionPi: roundPi(completed.reduce((s, o) => s + o.commissionPi, 0)),
      };
    },
  }),
} satisfies ActionsModule;
