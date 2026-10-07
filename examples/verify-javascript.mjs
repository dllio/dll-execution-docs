// Node.js 20+: one read-only assessment of a public historical transaction.
// No wallet connection, signer, broadcast, payment or automatic retry.
const request = {
  transaction_hash: "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533",
  expectation: {
    chain_id: "8453",
    inclusion: "included",
    receipt_status: "success",
  },
};

try {
  const response = await fetch("https://execution.dll.io/v2/execution/verify", {
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
    switch (result.verification.state) {
      case "VERIFIED":
        console.log("Requested checks satisfied; no finality or authorization guarantee.");
        break;
      case "CONTRADICTED":
        console.log("At least one requested check is contradicted; inspect checks and reasons.");
        break;
      case "INDETERMINATE":
        console.log("Insufficient evidence; inspect outcome and observation_errors.");
        break;
      default:
        throw new Error("Unexpected Verification state; consult live OpenAPI.");
    }
    const cost = result.realized_cost;
    if (cost.gas_used !== null && cost.effective_gas_price_wei !== null &&
        cost.realized_l2_execution_fee_wei !== null) {
      const l2Fee = BigInt(cost.gas_used) * BigInt(cost.effective_gas_price_wei);
      if (l2Fee !== BigInt(cost.realized_l2_execution_fee_wei)) {
        throw new Error("Inconsistent realized L2 fee; do not infer a total cost.");
      }
    }
    // Missing fees are unknown, not zero. Never infer finalized from VERIFIED.
  }
} catch (error) {
  console.error(`Verification request failed: ${error.message}`);
  process.exitCode = 1;
}
