import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Run the existing files in an otherwise empty directory, with no npm packages.
// Injected fetch prevents real network traffic in every scenario.
let directory;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "dll-http-example-"));
  for (const name of ["javascript.mjs", "verify-javascript.mjs"]) {
    await copyFile(
      new URL(`../examples/${name}`, import.meta.url),
      join(directory, name),
    );
  }
});
after(async () => rm(directory, { recursive: true, force: true }));

function run(name, scenario) {
  const program = `
    import { pathToFileURL } from 'node:url';
    const scenario = JSON.parse(process.argv[1]);
    const logs = [], errors = [], calls = [];
    const output = console.log.bind(console);
    console.log = (...values) => logs.push(values.join(' '));
    console.error = (...values) => errors.push(values.join(' '));
    globalThis.fetch = async (url, init) => {
      calls.push({ url, method: init.method, redirect: init.redirect,
        credentials: init.credentials, body: JSON.parse(init.body),
        headers: init.headers, hasDeadline: init.signal instanceof AbortSignal });
      if (scenario.transportError) throw new Error('Synthetic offline transport error');
      return new Response(scenario.raw ?? JSON.stringify(scenario.response), {
        status: scenario.status ?? 200, headers: scenario.headers,
      });
    };
    await import(pathToFileURL(process.argv[2]).href);
    output(JSON.stringify({ logs, errors, calls, exitCode: process.exitCode ?? 0 }));
  `;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      program,
      JSON.stringify(scenario),
      join(directory, name),
    ],
    { cwd: directory, encoding: "utf8", timeout: 5000 },
  );
  assert.equal(child.error, undefined);
  assert.ok([0, 1].includes(child.status), child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.exitCode, child.status);
  assert.equal(
    result.calls.length,
    1,
    "Exactly one request; no retry or fallback",
  );
  const call = result.calls[0];
  assert.equal(
    call.url,
    `https://execution.dll.io/v2/execution/${name.startsWith("verify") ? "verify" : "preflight"}`,
  );
  assert.equal(call.method, "POST");
  assert.equal(call.redirect, "error");
  assert.equal(call.credentials, "omit");
  assert.equal(call.hasDeadline, true);
  assert.deepEqual(call.headers, { "Content-Type": "application/json" });
  return result;
}

for (const state of ["PASS", "CAUTION", "BLOCK", "INDETERMINATE"]) {
  test(`standalone Preflight preserves ${state}, reasons and unavailable evidence`, () => {
    const response = {
      judgment: {
        state,
        reasons: [{ code: "SYNTHETIC_REASON", evidence_refs: ["fixture-1"] }],
      },
      evidence: [{ id: "fixture-1", status: "unavailable" }],
      cost_estimate: {
        total_transaction_cost: { amount_wei: null, status: "unavailable" },
      },
    };
    const result = run("javascript.mjs", { response });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.logs[0]), response);
    assert.equal(result.logs[1], `Judgment: ${state}`);
    assert.equal(result.calls[0].body.candidate.chain_id, "8453");
    assert.equal(result.calls[0].body.candidate.value, "0");
  });
}
for (const state of ["VERIFIED", "CONTRADICTED", "INDETERMINATE"]) {
  test(`standalone Verification preserves ${state} and requests receipt success explicitly`, () => {
    const response = {
      verification: { state, reasonCodes: ["SYNTHETIC_REASON"], checks: [] },
      outcome: { finality: "unknown" },
      observation_errors: [],
      realized_cost: {
        gas_used: null,
        effective_gas_price_wei: null,
        realized_l2_execution_fee_wei: null,
      },
    };
    const result = run("verify-javascript.mjs", { response });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.logs[0]), response);
    assert.equal(result.calls[0].body.expectation.receipt_status, "success");
    assert.equal(result.calls[0].body.expectation.inclusion, "included");
  });
}
for (const name of ["javascript.mjs", "verify-javascript.mjs"]) {
  test(`${name}: HTTP 429 keeps retry guidance and never retries`, () => {
    const response = { error: { code: "RATE_LIMITED", retryable: true } };
    const result = run(name, {
      status: 429,
      headers: { "Retry-After": "30" },
      response,
    });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(JSON.parse(result.errors[0]), {
      http_status: 429,
      retry_after: "30",
      error: response.error,
    });
  });
  test(`${name}: malformed JSON and transport errors fail without success output`, () => {
    for (const scenario of [
      { raw: "<html>unavailable</html>" },
      { transportError: true },
    ]) {
      const result = run(name, scenario);
      assert.equal(result.exitCode, 1);
      assert.equal(result.logs.length, 0);
    }
  });
  test(`${name}: HTTP 200 with missing or unknown domain state fails`, () => {
    for (const state of [undefined, "UNRECOGNIZED"]) {
      const response = name.startsWith("verify")
        ? { verification: { state } }
        : { judgment: { state } };
      assert.equal(run(name, { response }).exitCode, 1);
    }
  });
}
test("Verification refuses inconsistent realized L2 fees without inventing a total", () => {
  const result = run("verify-javascript.mjs", {
    response: {
      verification: { state: "VERIFIED" },
      realized_cost: {
        gas_used: "21000",
        effective_gas_price_wei: "2",
        realized_l2_execution_fee_wei: "1",
      },
    },
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.errors[0], /Inconsistent realized L2 fee/);
});
