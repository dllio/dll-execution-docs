// Node.js 20+: one harmless read-only USDC balanceOf assessment.
// No signer, wallet connection, payment or automatic retry.
const request = {
  candidate: {
    chain_id: "8453",
    from: "0x1111111111111111111111111111111111111111",
    to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    value: "0",
    data: "0x70a082310000000000000000000000001111111111111111111111111111111111111111",
  },
};

try {
  const response = await fetch("https://execution.dll.io/v2/execution/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: response was not JSON`);
  }

  if (!response.ok) {
    console.error(JSON.stringify({
      http_status: response.status,
      retry_after: response.headers.get("Retry-After"),
      error: result.error,
    }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
    // HTTP success does not imply PASS, execution or economic value.
    console.log(`Judgment: ${result.judgment.state}`);
    // Amounts are decimal strings; keep them as strings or use BigInt for wei.
    // Do not substitute the L2 estimate for unavailable total cost.
  }
} catch (error) {
  console.error(`Preflight request failed: ${error.message}`);
  process.exitCode = 1;
}
