// Browser fetch and proxy failures never reach the contract's error taxonomy,
// so they need their own classifier. Shared with reads.js so the retry decision
// and the user-facing message can never diverge.
const NETWORK_ERROR_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|econnreset|etimedout|epipe|socket hang up|user aborted|request aborted|the user aborted|load failed|bad gateway|service unavailable|\b502\b|\b503\b|\b504\b|certificate|getaddrinfo|dns lookup/i;

export function isNetworkError(text) {
  return NETWORK_ERROR_PATTERN.test(String(text || ""));
}

const rules = [
  {
    match: /caller is not authorized/i,
    message: "This account doesn't have the role needed for this action.",
    action: "Connect an account with the required role.",
  },
  {
    match: /invalid state transition/i,
    message: "This action isn't available at the dispute's current stage.",
    action: "Refresh the record and check the available actions.",
  },
  {
    match: /proposal already exists/i,
    message: "That proposal id is already registered on chain.",
    action: "Use a different proposal id.",
  },
  {
    match: /challenge window closed/i,
    message: "The challenge window has closed for this assessment.",
    action: "The assessment can now be finalized if nothing else is pending.",
  },
  {
    match: /challenge window still open/i,
    message: "The challenge window is still open. Finalizing opens when it closes.",
    action: "Wait for the window to close, then finalize.",
  },
  {
    match: /maximum challenge rounds reached/i,
    message: "No more challenge rounds are available for this dispute.",
    action: "Finalize the dispute after the window closes.",
  },
  {
    match: /evidence cap reached/i,
    message: "This dispute has reached its evidence limit.",
    action: "Use the existing evidence or escalate.",
  },
  {
    match: /dispute already exists/i,
    message: "That dispute id is taken. A new one was generated; try again.",
    action: "Retry with the generated id.",
  },
  {
    match: /rule is deprecated/i,
    message: "That rule version is deprecated. Choose the current version.",
    action: "Reload the rule list and choose an active rule.",
  },
  {
    match: /category requires escalation/i,
    message: "This category goes to the DAO's own procedure. Use Escalate.",
    action: "Use the escalation action instead of finalizing.",
  },
  {
    match: /caller recorded the disputed events/i,
    message:
      "Strict separation is on: the recorder of these events can't take part in the dispute.",
    action: "Use a different account.",
  },
  {
    match: /rate limit|too many requests|429/i,
    message: "The demo RPC is rate-limited right now. No data was changed.",
    action: "Wait about a minute, then retry.",
  },
  {
    match: /^EXTERNAL:/i,
    message:
      "A source couldn't be reached. This isn't a finding about the claim.",
    action: "Try again later.",
  },
  {
    match: /^TRANSIENT:/i,
    message: "The network timed out. Nothing changed.",
    action: "Try again.",
  },
  {
    match: /model tried to override a failed deterministic check/i,
    message:
      "Validators couldn't produce a valid answer. Nothing changed. Request the assessment again.",
    action: "Request the assessment again.",
  },
  {
    match: /decisive verdict must cite evidence|cites no readable evidence/i,
    message:
      "The evidence couldn't support a decisive answer. Nothing changed.",
    action: "Add readable evidence or try again.",
  },
  {
    match: /^LLM_ERROR:/i,
    message:
      "Validators couldn't produce a usable answer. Nothing changed. Request the assessment again.",
    action: "Request the assessment again.",
  },
  {
    // Last rule on purpose: contract-prefixed messages must match first.
    match: NETWORK_ERROR_PATTERN,
    message: "The network request failed or the RPC endpoint refused it. Nothing was changed.",
    action: "Check the connection and try again.",
  },
];

export function explainError(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return {
      message: "Something unexpected happened. Details are below.",
      action: "Try again or inspect the transaction.",
      raw: "",
    };
  }
  const found = rules.find((rule) => rule.match.test(text));
  if (found) return { message: found.message, action: found.action, raw: text };
  return {
    message: "Something unexpected happened. Details are below.",
    action: "Try again or inspect the transaction.",
    raw: text,
  };
}