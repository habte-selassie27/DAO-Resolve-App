import { contractAddress, mockMode } from "../../config/contracts.js";
import { readClient } from "./clients.js";
import { isNetworkError } from "../errors.js";
import { mergeProposalIds, readRememberedProposals } from "../proposalRegistry.js";
import * as mock from "../mock/client.js";

export function normalize(value) {
  if (value instanceof Map) {
    const object = {};
    for (const [key, item] of value.entries()) object[String(key)] = normalize(item);
    return object;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

const cache = new Map();
const CACHE_TTL_MS = 15000;

export function clearReadCache() {
  cache.clear();
}

async function withRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    const message = String(error?.message || error);
    if (/rate limit|too many requests|429/i.test(message)) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return operation();
    }
    // The shared public endpoint can hiccup under the burst of reads a screen
    // fires on load. One quick retry turns a whole-screen failure into a delay.
    if (isNetworkError(message)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return operation();
    }
    throw error;
  }
}

async function read(functionName, args = []) {
  if (!contractAddress) {
    throw new Error("No contract address is configured for this network. Set VITE_CONTRACT_ADDRESS.");
  }
  const key = `${functionName}:${JSON.stringify(args)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const result = await withRetry(async () => {
    const value = await readClient.readContract({
      address: contractAddress,
      functionName,
      args,
    });
    return normalize(value);
  });
  cache.set(key, { at: Date.now(), value: result });
  return result;
}

export async function getConfig() {
  if (mockMode) return mock.getConfig();
  return read("get_config");
}
export async function listActiveRules(offset = 0, limit = 50) {
  if (mockMode) return mock.listActiveRules(offset, limit);
  return read("list_active_rules", [offset, limit]);
}
export async function getRule(ruleId) {
  if (mockMode) return mock.getRule(ruleId);
  return read("get_rule", [ruleId]);
}
export async function getRuleVersion(ruleId, version) {
  if (mockMode) return mock.getRuleVersion(ruleId, version);
  return read("get_rule_version", [ruleId, version]);
}
export async function getProposal(proposalId) {
  if (mockMode) return mock.getProposal(proposalId);
  return read("get_proposal", [proposalId]);
}
export async function getEvents(proposalId, offset = 0, limit = 50) {
  if (mockMode) return mock.getEvents(proposalId, offset, limit);
  return read("get_events", [proposalId, offset, limit]);
}
export async function getAllEvents(proposalId, max = 128) {
  const events = [];
  for (let offset = 0; offset < max; offset += 50) {
    const page = await getEvents(proposalId, offset, Math.min(50, max - offset));
    if (!Array.isArray(page) || page.length === 0) break;
    events.push(...page);
    if (page.length < 50) break;
  }
  return events;
}
export async function listDisputes(offset = 0, limit = 50) {
  if (mockMode) return mock.listDisputes(offset, limit);
  return read("list_disputes", [offset, limit]);
}
export async function getDispute(disputeId) {
  if (mockMode) return mock.getDispute(disputeId);
  return read("get_dispute", [disputeId]);
}
export async function getDisputeStatus(disputeId) {
  if (mockMode) return mock.getDisputeStatus(disputeId);
  return read("get_dispute_status", [disputeId]);
}
export async function getEvidence(disputeId, offset = 0, limit = 50) {
  if (mockMode) return mock.getEvidence(disputeId, offset, limit);
  return read("get_evidence", [disputeId, offset, limit]);
}
export async function getAssessmentHistory(disputeId, offset = 0, limit = 50) {
  if (mockMode) return mock.getAssessmentHistory(disputeId, offset, limit);
  return read("get_assessment_history", [disputeId, offset, limit]);
}
export async function getChallenges(disputeId, offset = 0, limit = 50) {
  if (mockMode) return mock.getChallenges(disputeId, offset, limit);
  return read("get_challenges", [disputeId, offset, limit]);
}

export async function listProposals(offset = 0, limit = 50) {
  if (mockMode) return mock.listProposals(offset, limit);
  if (!contractAddress) {
    throw new Error("No contract address is configured for this network. Set VITE_CONTRACT_ADDRESS.");
  }
  try {
    return await read("list_proposals", [offset, limit]);
  } catch (error) {
    const message = String(error?.message || error);
    if (/unknown.*list_proposals/i.test(message) || /method not found/i.test(message)) {
      return listProposalsFromDiscovery(offset, limit);
    }
    throw error;
  }
}

export async function listRules(offset = 0, limit = 50) {
  if (mockMode) return mock.listRules(offset, limit);
  return read("list_rules", [offset, limit]);
}

async function listProposalsFromDiscovery(offset = 0, limit = 50) {
  const configured = (import.meta.env.VITE_PROPOSAL_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  let disputed = [];
  try {
    const disputes = await listDisputes(0, 50);
    disputed = (disputes || []).map((item) => item?.proposal_id).filter(Boolean);
  } catch {
    disputed = [];
  }
  const ids = mergeProposalIds(configured, readRememberedProposals(), disputed);
  const page = ids.slice(offset, offset + limit);
  const proposals = await Promise.all(
    page.map(async (id) => {
      try {
        return await getProposal(id);
      } catch {
        return null;
      }
    })
  );
  return proposals.filter(Boolean);
}
