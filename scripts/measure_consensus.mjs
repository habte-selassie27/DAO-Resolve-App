// Measure the interpretation consensus: repeat the same dispute against the same
// pinned rule version and the same live evidence, and report what the validators did.
//
// Every run is a real transaction on the configured network:
//   open_dispute -> submit_evidence -> evaluate_dispute -> read the assessment back
//
// Writes go through the `genlayer` CLI so the signing key stays in its keystore and
// is never loaded into this process. Receipts and state are read with genlayer-js.
//
// Usage:
//   CONTRACT_ADDRESS=0x... RUNS=8 node scripts/measure_consensus.mjs
//   RUNS=8 RULE_ID=R-DISCUSSION PROPOSAL_ID=ENS-PRICING PREFIX=M-ENS OUT=/tmp/report.json \
//     node scripts/measure_consensus.mjs
//
// Exit code is non-zero only when the measurement could not run at all.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const run = promisify(execFile);

const address = process.env.CONTRACT_ADDRESS || "";
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error("Set CONTRACT_ADDRESS to the deployed DAOResolve contract.");
  process.exit(1);
}

const fixedDisputeId = process.env.DISPUTE_ID || "";
const runs = fixedDisputeId ? 1 : Number(process.env.RUNS || 8);
const ruleId = process.env.RULE_ID || "R-DISCUSSION";
const proposalId = process.env.PROPOSAL_ID || "ENS-PRICING";
const prefix = process.env.PREFIX || "M-ENS";
const stamp = process.env.STAMP || String(Math.floor(Date.now() / 1000)).slice(-6);
const evidenceUrl = process.env.EVIDENCE_URL || "https://discuss.ens.domains/t/22506.json";
const claim =
  process.env.CLAIM ||
  "This proposal must be assessed against R-DISCUSSION using the linked ENS forum thread as the primary evidence.";
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 300000);
const POLL_INTERVAL_MS = 4000;

const client = createClient({ chain: studionet });

// genlayer-js returns Maps for contract structs; make the output plain JSON.
function normalize(value) {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), normalize(item)]));
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

async function read(method, args = []) {
  return normalize(await client.readContract({ address, functionName: method, args }));
}

// genlayer-js exposes the readable status as `statusName`; older shapes use `status_name`.
// Numeric fallbacks: 5 = ACCEPTED, 7 = FINALIZED, 6 = UNDETERMINED, 8 = CANCELED.
const STATUS_BY_NUMBER = { 5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED" };
function statusOf(receipt) {
  const named = receipt?.statusName ?? receipt?.status_name;
  if (named) return String(named).toUpperCase();
  return STATUS_BY_NUMBER[Number(receipt?.status)] || String(receipt?.status ?? "UNKNOWN");
}

function summarizeReceipt(receipt) {
  const validators = receipt?.consensus_data?.validators || [];
  const tally = { AGREE: 0, DISAGREE: 0, IDLE: 0, OTHER: 0 };
  for (const validator of validators) {
    const vote = String(validator?.vote || "").toUpperCase();
    tally[vote in tally ? vote : "OTHER"] += 1;
  }
  const leader = receipt?.consensus_data?.leader_receipt?.[0];
  return {
    status: receipt ? statusOf(receipt) : null,
    ...tally,
    validators: validators.length,
    rotations: receipt?.consensus_data?.rotations ?? 0,
    leader_execution_result: leader?.execution_result ?? null,
  };
}

async function waitForReceipt(hash) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = normalize(await client.getTransaction({ hash }));
      const status = last ? statusOf(last) : "";
      if (status === "ACCEPTED" || status === "FINALIZED") return last;
      if (status === "UNDETERMINED" || status === "CANCELED") return last;
    } catch {
      // Not visible yet; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return last;
}

// One write through the CLI. `args` are already contract-typed JSON literals.
async function send(method, args) {
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = await run(
      "genlayer",
      ["write", address, method, "--args", ...args],
      { maxBuffer: 32 * 1024 * 1024, timeout: POLL_TIMEOUT_MS }
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = error?.stdout || "";
    stderr = error?.stderr || "";
    exitCode = error?.code ?? 1;
  }

  const hashMatch = stdout.match(/Write Transaction Hash:\s*\n\s*(0x[0-9a-fA-F]{64})/);
  if (!hashMatch) {
    const message = (stderr || stdout).split("\n").filter((line) => line.trim()).slice(-4).join(" ");
    return { method, ok: false, hash: null, exit_code: exitCode, error: message || "no transaction hash" };
  }

  const receipt = await waitForReceipt(hashMatch[1]);
  const summary = receipt ? summarizeReceipt(receipt) : { status: "UNKNOWN" };
  const ok =
    summary.status === "ACCEPTED" || summary.status === "FINALIZED"
      ? summary.leader_execution_result === "SUCCESS"
      : false;
  return {
    method,
    ok,
    hash: hashMatch[1],
    exit_code: exitCode,
    ...summary,
    ...(ok ? {} : { error: `execution ${summary.leader_execution_result ?? "did not succeed"}` }),
  };
}

// The CLI takes raw argument values; it does not strip JSON quoting.
const arg = (value) => String(value);

const rule = await read("get_rule", [ruleId]);
console.error(
  `contract ${address}\nrule ${rule.rule_id} v${rule.version} (${rule.interpretation})\n` +
    `proposal ${proposalId}\nevidence ${evidenceUrl}\nruns ${runs}, prefix ${prefix}-${stamp}\n`
);

const results = [];

for (let i = 1; i <= runs; i += 1) {
  const disputeId = fixedDisputeId || `${prefix}-${stamp}-${i}`;
  const entry = {
    run: i,
    dispute_id: disputeId,
    steps: [],
    verdict: null,
    band: null,
    decided_by: null,
    cited_evidence: null,
    failed_at: null,
  };
  console.error(`--- run ${i}/${runs}: ${disputeId}`);

  // SKIP_OPEN=1 resumes a dispute that was opened by an interrupted run.
  if (process.env.SKIP_OPEN === "1") {
    entry.steps.push({ method: "open_dispute", ok: true, skipped: true });
    console.error("  open_dispute      skipped (resuming)");
  } else {
    const opened = await send("open_dispute", [arg(disputeId), arg(ruleId), arg(proposalId), arg(claim)]);
    entry.steps.push(opened);
    console.error(`  open_dispute      ${opened.ok ? "ok" : `FAILED ${opened.error}`}`);
    if (!opened.ok) {
      entry.failed_at = "open_dispute";
      results.push(entry);
      continue;
    }
  }

  const evidence = await send("submit_evidence", [arg(disputeId), arg("NEUTRAL"), arg("URL"), arg(evidenceUrl)]);
  entry.steps.push(evidence);
  console.error(`  submit_evidence   ${evidence.ok ? "ok" : `FAILED ${evidence.error}`}`);
  if (!evidence.ok) {
    entry.failed_at = "submit_evidence";
    results.push(entry);
    continue;
  }

  const evaluated = await send("evaluate_dispute", [arg(disputeId)]);
  entry.steps.push(evaluated);
  console.error(
    `  evaluate_dispute  ${evaluated.ok ? "ok" : `FAILED ${evaluated.error}`}` +
      (evaluated.validators ? `  votes ${evaluated.AGREE}A/${evaluated.DISAGREE}D/${evaluated.IDLE}I` : "")
  );
  if (!evaluated.ok) entry.failed_at = "evaluate_dispute";

  try {
    const history = await read("get_assessment_history", [disputeId, 0, 10]);
    const latest = history[history.length - 1];
    entry.assessments = history.length;
    if (latest) {
      entry.verdict = latest.verdict;
      entry.band = latest.confidence_band;
      entry.decided_by = latest.decided_by;
      entry.cited_evidence = latest.cited_evidence_ids;
      entry.assessment_id = latest.assessment_id;
    }
  } catch (error) {
    entry.read_error = String(error?.message || error);
  }
  console.error(
    entry.verdict
      ? `  assessment        ${entry.verdict} / ${entry.band} / ${entry.decided_by} / cited ${JSON.stringify(entry.cited_evidence)}`
      : "  assessment        none recorded"
  );

  results.push(entry);
}

const assessed = results.filter((entry) => entry.verdict);
const countBy = (key) => {
  const counts = {};
  for (const entry of assessed) counts[entry[key]] = (counts[entry[key]] || 0) + 1;
  return counts;
};
const voteTotals = { AGREE: 0, DISAGREE: 0, IDLE: 0, OTHER: 0, validators: 0, rotations: 0 };
for (const entry of results) {
  for (const step of entry.steps) {
    for (const key of Object.keys(voteTotals)) voteTotals[key] += step[key] || 0;
  }
}

const trial = { contract: address, rule: { id: rule.rule_id, version: rule.version, interpretation: rule.interpretation }, proposal: proposalId, evidence: evidenceUrl, runs_attempted: runs, runs_assessed: assessed.length, runs_failed: runs - assessed.length, verdicts: countBy("verdict"), bands: countBy("band"), validator_votes: voteTotals, results };

console.log(JSON.stringify(trial, null, 2));
if (process.env.OUT) {
  writeFileSync(process.env.OUT, JSON.stringify(trial, null, 2));
  console.error(`\nwrote ${process.env.OUT}`);
}
