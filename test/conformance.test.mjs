import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { benchmarkWithAuthorizedWallet } from "../examples/benchmark-handshake.mjs";
const url = "https://execution.dll.io/v1/benchmark/transactions";
const payTo = "0x2222222222222222222222222222222222222222";
const body = { transaction_hashes: ["0x" + "1".repeat(64)], window: "7d" };

test("task selection and fee descriptions preserve the current conditional scope", async () => {
  const files = [
    "README.md",
    "PREFLIGHT.md",
    "MCP.md",
    "AGENTS.md",
    "CAPABILITY_SELECTION.md",
  ];
  const docs = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        await readFile(new URL("../" + file, import.meta.url), "utf8"),
      ]),
    ),
  );
  assert.match(
    docs["README.md"],
    /^# DLL Execution — Base transaction simulation and verification for AI agents/m,
  );
  assert.match(
    docs["README.md"],
    /L1 data, L2 execution, applicable Operator Fee and Total Network Fee/,
  );
  assert.match(docs["README.md"], /does not recompute legacy Judgment/);
  assert.doesNotMatch(
    docs["README.md"],
    /CAUTION`: L1 data fee and total transaction cost are unavailable/,
  );
  assert.match(
    docs["PREFLIGHT.md"],
    /separate \[conditional network fee estimate\]/,
  );
  assert.match(docs["MCP.md"], /does not recompute legacy Judgment/);
  assert.match(
    docs["MCP.md"],
    /directory listing does not grant a client permission/,
  );
  assert.match(docs["AGENTS.md"], /network_fee_estimate/);
  assert.match(docs["AGENTS.md"], /not exact signed-transaction cost/);
  assert.match(
    docs["CAPABILITY_SELECTION.md"],
    /net asset-delta verification, comprehensive malicious-contract scanning/,
  );
  for (const text of Object.values(docs)) {
    assert.match(text, /Base Mainnet/);
    assert.doesNotMatch(
      text,
      /\/ops\b|BASE_RPC_URL|DATABASE_URL|CDP_API_KEY|evaluation_work_v1/,
    );
  }
});
function challenge(stage, extra = {}) {
  const required = {
    x402Version: 2,
    resource: { url },
    accepts: [
      {
        scheme: "upto",
        network: "eip155:8453",
        asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        payTo,
        amount: "5000",
        maxTimeoutSeconds: 300,
        extra: {
          facilitatorAddress: "0x3333333333333333333333333333333333333333",
        },
        ...extra,
      },
    ],
    extensions: { bazaar: { info: {} }, "sign-in-with-x": { info: {} } },
  };
  return new Response("{}", {
    status: 402,
    headers: {
      "X-DLL-Benchmark-Stage": stage,
      "PAYMENT-REQUIRED": JSON.stringify(required),
    },
  });
}
function setup(responses, extra = {}) {
  const calls = [];
  const counts = { payments: 0, proofs: 0 };
  const client = {
    getPaymentRequiredResponse: (get) => JSON.parse(get("PAYMENT-REQUIRED")),
    createPaymentPayload: async (r) => {
      counts.payments++;
      return { resource: r.resource, extensions: r.extensions };
    },
    encodePaymentSignatureHeader: () => ({
      "PAYMENT-SIGNATURE": "synthetic-fixed-envelope",
    }),
    handlePaymentRequired: async () => ({
      "sign-in-with-x": "synthetic-proof-" + ++counts.proofs,
    }),
  };
  return {
    counts,
    calls,
    input: {
      client,
      body,
      idempotencyKey: "one-logical-request",
      trustedPayTo: payTo,
      maxAuthorizationAtomic: "5000",
      fetchImpl: async (endpoint, options) => {
        assert.equal(endpoint, url);
        calls.push(options);
        assert.ok(responses.length);
        return responses.shift();
      },
      ...extra,
    },
  };
}
test("free flow never creates payment even with nonempty accepts and zero spend budget", async () => {
  const s = setup([challenge("identity"), new Response("{}")], {
    maxAuthorizationAtomic: "0",
  });
  assert.equal((await benchmarkWithAuthorizedWallet(s.input)).status, 200);
  assert.deepEqual(s.counts, { payments: 0, proofs: 1 });
});
test("one paid envelope survives fresh identity with exact body/key", async () => {
  const s = setup(
    [
      challenge("identity"),
      challenge("payment"),
      challenge("identity"),
      new Response("{}"),
    ],
    { authorizePayment: async () => true },
  );
  assert.equal((await benchmarkWithAuthorizedWallet(s.input)).status, 200);
  assert.equal(s.counts.payments, 1);
  assert.equal(new Set(s.calls.map((c) => c.body)).size, 1);
  assert.equal(
    new Set(s.calls.map((c) => c.headers["Idempotency-Key"])).size,
    1,
  );
  assert.equal(
    s.calls[2].headers["PAYMENT-SIGNATURE"],
    s.calls[3].headers["PAYMENT-SIGNATURE"],
  );
  assert.notEqual(
    s.calls[2].headers["SIGN-IN-WITH-X"],
    s.calls[3].headers["SIGN-IN-WITH-X"],
  );
});
test("pending returns without second authorization or automatic retry", async () => {
  const s = setup([challenge("payment"), new Response("{}", { status: 503 })], {
    authorizePayment: async () => true,
  });
  assert.equal((await benchmarkWithAuthorizedWallet(s.input)).status, 503);
  assert.equal(s.counts.payments, 1);
  assert.equal(s.calls.length, 2);
});
test("no/denied approval and untrusted recipient/network/cap/timeout/facilitator fail closed", async () => {
  for (const authorizePayment of [undefined, async () => false]) {
    const s = setup([challenge("payment")], { authorizePayment });
    await assert.rejects(() => benchmarkWithAuthorizedWallet(s.input));
    assert.equal(s.counts.payments, 0);
  }
  for (const changed of [
    { payTo: "0x4444444444444444444444444444444444444444" },
    { network: "eip155:84532" },
    { amount: "5001" },
    { amount: 5000 },
    { maxTimeoutSeconds: 301 },
    { extra: { facilitatorAddress: "0x" + "0".repeat(40) } },
  ]) {
    const s = setup([challenge("payment", changed)], {
      authorizePayment: async () => true,
    });
    await assert.rejects(() => benchmarkWithAuthorizedWallet(s.input));
    assert.equal(s.counts.payments, 0);
  }
});
test("second payment stage and endless identity negotiation are bounded", async () => {
  const s = setup([challenge("payment"), challenge("payment")], {
    authorizePayment: async () => true,
  });
  await assert.rejects(() => benchmarkWithAuthorizedWallet(s.input));
  assert.equal(s.counts.payments, 1);
  const repeated = setup(
    Array.from({ length: 6 }, () => challenge("identity")),
  );
  await assert.rejects(() => benchmarkWithAuthorizedWallet(repeated.input));
  assert.equal(repeated.calls.length, 6);
  await assert.rejects(() =>
    benchmarkWithAuthorizedWallet(setup([challenge("unknown")]).input),
  );
});
test("network failure is unknown, never automatically retried", async () => {
  let attempts = 0;
  const s = setup([], {
    fetchImpl: async () => {
      attempts++;
      throw new Error("Synthetic timeout.");
    },
  });
  await assert.rejects(() => benchmarkWithAuthorizedWallet(s.input));
  assert.equal(attempts, 1);
});
test("public local links, JSON syntax and handshake guidance remain coherent", async () => {
  for (const file of [
    "README.md",
    "AGENTS.md",
    "QUICKSTART.md",
    "CAPABILITY_SELECTION.md",
    "PREFLIGHT.md",
    "VERIFICATION.md",
    "BENCHMARK.md",
    "BENCHMARK_CLIENT.md",
    "MCP.md",
  ]) {
    const text = await readFile(new URL("../" + file, import.meta.url), "utf8");
    assert.doesNotMatch(
      text,
      /\/ops\b|OPS_[A-Z_]+|CDP_API_KEY|DATABASE_URL|161\.35\.7\.112|\/home\/deploy|evaluation_work_v1/,
    );
    for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^https:\/\//.test(match[1])) continue;
      assert.ok(
        !/^[a-z]+:|^\/|\.\./i.test(match[1]),
        "Local links must remain within this public repository.",
      );
      const [path, anchor] = match[1].split("#");
      const target = await readFile(
        new URL("../" + (path || file), import.meta.url),
        "utf8",
      );
      if (anchor)
        assert.ok(
          [...target.matchAll(/^#{1,6}\s+(.+)$/gm)]
            .map((m) =>
              m[1]
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s_-]/gu, "")
                .replace(/\s/g, "-"),
            )
            .includes(anchor),
        );
    }
    for (const match of text.matchAll(
      /\x60\x60\x60json\s*\n([\s\S]*?)\n\x60\x60\x60/g,
    ))
      JSON.parse(match[1]);
  }
  const guide = await readFile(
    new URL("../BENCHMARK.md", import.meta.url),
    "utf8",
  );
  for (const required of [
    "X-DLL-Benchmark-Stage",
    "N × 5000",
    "same PAYMENT-SIGNATURE",
    "PAYMENT_PENDING",
  ])
    assert.ok(guide.includes(required));
});
