import {
  definePrivilegedContracts,
  definePrivilegedHandlers,
  z,
} from "@hatch/space-sdk";
import {
  Asset,
  Horizon,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

/**
 * Host-only Pi payment capabilities. The secrets live ONLY in server
 * environment variables, entered by the developer in the secret manager —
 * never in code, chat, the database, or any action response:
 *   PI_NETWORK_API_KEY — the app's Server API Key from the Pi Developer
 *     Portal, used as `Authorization: Key …` against the Pi Platform API.
 *   PI_WALLET_SEED — the app wallet's secret seed, used only here to sign
 *     the app_to_user payout transaction on the Pi blockchain.
 *   PI_NETWORK — "mainnet" or "testnet" (default): picks the Pi blockchain
 *     horizon + network passphrase, so one codebase deploys to both.
 * Action code never sees either value: it only gets booleans, parsed Pi
 * API responses, and transaction ids back.
 */
export const privileged = definePrivilegedContracts({
  piConfig: {
    request: z.object({}),
    response: z.object({
      paymentsEnabled: z.boolean(),
      payoutsEnabled: z.boolean(),
    }),
  },
  piApi: {
    request: z.object({
      path: z.string().min(1).max(300),
      method: z.enum(["GET", "POST"]),
      body: z.record(z.string(), z.unknown()).optional(),
    }),
    response: z.object({ data: z.record(z.string(), z.unknown()) }),
  },
  piSubmitPayout: {
    request: z.object({
      destination: z.string().min(40).max(64),
      amountPi: z.number().positive().max(100000),
      paymentId: z.string().min(1).max(128),
    }),
    response: z.object({ txid: z.string() }),
    timeoutMs: 60000,
  },
});

const PI_API_BASE = "https://api.minepi.com/v2";

function serverEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

/**
 * Pi blockchain API — network-aware via the PI_NETWORK env var so ONE
 * codebase deploys to both networks:
 *   PI_NETWORK=mainnet → Pi Mainnet (api.mainnet.minepi.com, "Pi Network")
 *   unset / anything else → Pi Testnet (default, keeps Testnet working)
 */
const PI_NETWORK = (serverEnv("PI_NETWORK") ?? "testnet").toLowerCase();
const IS_MAINNET = PI_NETWORK === "mainnet";
const PI_HORIZON_URL = IS_MAINNET
  ? "https://api.mainnet.minepi.com"
  : "https://api.testnet.minepi.com";
const PI_NETWORK_PASSPHRASE = IS_MAINNET ? "Pi Network" : "Pi Testnet";

/** Stellar amounts are strings with at most 7 decimal places. */
function stellarAmount(n: number): string {
  return n.toFixed(7).replace(/0+$/, "").replace(/\.$/, ".0");
}

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  piConfig() {
    const apiKey = serverEnv("PI_NETWORK_API_KEY");
    const seed = serverEnv("PI_WALLET_SEED");
    return { paymentsEnabled: !!apiKey, payoutsEnabled: !!(apiKey && seed) };
  },

  async piApi({ path, method, body }) {
    const apiKey = serverEnv("PI_NETWORK_API_KEY");
    if (!apiKey)
      throw new Error(
        "الدفع الحقيقي بـ Pi مش مفعّل على السيرفر: المطوّر لسه محطش PI_NETWORK_API_KEY في إعدادات أسرار السيرفر.",
      );
    const res = await fetch(`${PI_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        typeof data.error_message === "string"
          ? data.error_message
          : typeof data.message === "string"
            ? data.message
            : `Pi API returned ${res.status}`;
      throw new Error(`Pi: ${msg}`);
    }
    return { data };
  },

  async piSubmitPayout({ destination, amountPi, paymentId }) {
    const seed = serverEnv("PI_WALLET_SEED");
    if (!seed)
      throw new Error(
        "محفظة التطبيق مش مهيأة على السيرفر: المطوّر لسه محطش PI_WALLET_SEED في إعدادات أسرار السيرفر.",
      );
    const horizon = new Horizon.Server(PI_HORIZON_URL);
    const source = Keypair.fromSecret(seed);
    const account = await horizon.loadAccount(source.publicKey());
    let fee = "100000";
    try {
      fee = String(await horizon.fetchBaseFee());
    } catch {
      /* keep the default base fee */
    }
    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: PI_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: stellarAmount(amountPi),
        }),
      )
      .addMemo(Memo.text(paymentId))
      .setTimeout(180)
      .build();
    tx.sign(source);
    const submitted = await horizon.submitTransaction(tx);
    return { txid: submitted.hash };
  },
});
