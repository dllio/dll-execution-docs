import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("public MCP contract/Registry declaration expose only two free tools without payment authority", async () => {
  const doc = await readFile(new URL("../MCP.md", import.meta.url), "utf8");
  const server = JSON.parse(
    await readFile(new URL("../server.json", import.meta.url), "utf8"),
  );
  assert.equal(server.name, "io.github.dllio/dll-execution");
  assert.equal(server.version, "0.1.0");
  assert.deepEqual(server.remotes, [
    { type: "streamable-http", url: "https://execution.dll.io/mcp" },
  ]);
  assert.equal(
    server.repository.url,
    "https://github.com/dllio/dll-execution-docs",
  );
  assert.match(doc, /not evidence that Grok Bot, Muse/);
  assert.match(doc, /REST and MCP share/);
  assert.match(doc, /false does \*\*not\*\* mean PASS/);
  const examples = [...doc.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) =>
    JSON.parse(m[1]),
  );
  assert.equal(examples.length, 5);
  assert.deepEqual(examples[0].allowed_tools, [
    "preflight_transaction",
    "verify_transaction",
  ]);
  const calls = examples.filter((e) => e.method === "tools/call");
  assert.deepEqual(
    calls.map((c) => c.params.name),
    ["preflight_transaction", "verify_transaction"],
  );
  assert.equal(calls[0].params.arguments.candidate.chain_id, "8453");
  assert.equal(calls[0].params.arguments.candidate.value, "0");
  assert.match(calls[1].params.arguments.transaction_hash, /^0x[0-9a-f]{64}$/);
  for (const text of [doc, JSON.stringify(server)])
    assert.doesNotMatch(
      text,
      /\/ops\b|BASE_RPC_URL|DATABASE_URL|CDP_API_KEY|161\.35\.7\.112|\/home\/deploy|evaluation_work_v1/,
    );
});
