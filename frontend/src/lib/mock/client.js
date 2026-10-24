import * as fixtures from "./fixtures.js";

const db = {
  config: structuredClone(fixtures.config),
  rules: structuredClone(fixtures.rules),
  proposals: structuredClone(fixtures.proposals),
  events: structuredClone(fixtures.events),
  disputes: structuredClone(fixtures.disputes),
  evidence: structuredClone(fixtures.evidence),
  assessments: structuredClone(fixtures.assessments),
  challenges: structuredClone(fixtures.challenges),
};

const transactions = new Map();
let sequence = 0;
let nextFailure = "";

export function failNext(message = "EXPECTED: invalid state transition") {
  nextFailure = message;
}

function hash() {
  sequence += 1;
  return `0x${String(sequence).padStart(64, "0")}`;
}

export async function getConfig() {
  return structuredClone(db.config);
}

export async function listActiveRules() {
  return Object.values(db.rules)
    .filter((rule) => rule.status === "ACTIVE")
    .map(({ rule_id, version, title, category, interpretation }) => ({
      rule_id,
      version,
      title,
      category,
      interpretation,
    }));
}

export async function getRule(ruleId) {
  const versions = Object.values(db.rules)
    .filter((rule) => rule.rule_id === ruleId)
    .sort((a, b) => b.version - a.version);
  if (!versions.length) throw new Error("EXPECTED: unknown rule");
  return structuredClone(versions[0]);
}

export async function getRuleVersion(ruleId, version) {
  const rule = db.rules[`${ruleId}#${version}`];
  if (!rule) throw new Error("EXPECTED: unknown rule version");
  return structuredClone(rule);
}

export async function getProposal(proposalId) {
  const proposal = db.proposals[proposalId];
  if (!proposal) throw new Error("EXPECTED: unknown proposal");
  return { ...structuredClone(proposal), event_count: (db.events[proposalId] || []).length };
}

export async function listProposals(offset = 0, limit = 50) {
  return Object.keys(db.proposals)
    .slice(offset, offset + limit)
    .map((id) => ({
      ...structuredClone(db.proposals[id]),
      event_count: (db.events[id] || []).length,
    }));
}

export async function listRules(offset = 0, limit = 50) {
  return Object.values(db.rules)
    .filter((rule) => rule.status === "ACTIVE")
    .slice(offset, offset + limit)
    .map(({ rule_id, version, title, clause_text, category, interpretation }) => ({
      rule_id,
      version,
      title,
      clause_text,
      category,
      interpretation,
    }));
}

export async function getEvents(proposalId, offset = 0, limit = 50) {
  return structuredClone((db.events[proposalId] || []).slice(offset, offset + limit));
}

export async function listDisputes(offset = 0, limit = 50) {
  return Object.values(db.disputes)
    .slice(offset, offset + limit)
    .map(({ dispute_id, rule_id, rule_version, proposal_id, status, challenge_count }) => ({
      dispute_id,
      rule_id,
      rule_version,
      proposal_id,
      status,
      challenge_count,
    }));
}

export async function getDispute(disputeId) {
  const dispute = db.disputes[disputeId];
  if (!dispute) throw new Error("EXPECTED: unknown dispute");
  return structuredClone(dispute);
}

export async function getDisputeStatus(disputeId) {
  return db.disputes[disputeId]?.status || "UNKNOWN";
}

export async function getEvidence(disputeId, offset = 0, limit = 50) {
  return structuredClone((db.evidence[disputeId] || []).slice(offset, offset + limit));
}

export async function getAssessmentHistory(disputeId, offset = 0, limit = 50) {
  return structuredClone((db.assessments[disputeId] || []).slice(offset, offset + limit));
}

export async function getChallenges(disputeId, offset = 0, limit = 50) {
  return structuredClone((db.challenges[disputeId] || []).slice(offset, offset + limit));
}

export async function write(functionName, args) {
  const txHash = hash();
  transactions.set(txHash, {
    hash: txHash,
    functionName,
    args,
    createdAt: Date.now(),
    failed: nextFailure,
    status: "PENDING",
  });
  nextFailure = "";
  return txHash;
}

export async function getTransaction({ hash: txHash }) {
  const tx = transactions.get(txHash);
  if (!tx) throw new Error("Unknown mock transaction");
  if (tx.failed) {
    return {
      hash: txHash,
      status: "FINALIZED",
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_ERROR",
      consensus_data: {
        leader_receipt: [{ error: tx.failed, execution_result: "ERROR" }],
      },
    };
  }
  const elapsed = Date.now() - tx.createdAt;
  let status = "PENDING";
  if (elapsed > 1200) status = "COMMITTING";
  if (elapsed > 2600) status = "ACCEPTED";
  if (elapsed > 5200) status = "FINALIZED";
  return {
    hash: txHash,
    status,
    statusName: status,
    txExecutionResultName: status === "FINALIZED" ? "FINISHED_WITH_RETURN" : "NOT_VOTED",
    consensus_data: { leader_receipt: [{ error: null }] },
  };
}

export function reset() {
  transactions.clear();
  sequence = 0;
  nextFailure = "";
}