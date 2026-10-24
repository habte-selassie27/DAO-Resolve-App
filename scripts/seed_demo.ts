import { execFileSync } from "node:child_process";

const contract = process.env.CONTRACT_ADDRESS || "";
if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
  console.error("Set CONTRACT_ADDRESS to the deployed DAOResolve contract.");
  process.exit(1);
}

const network = process.env.GENLAYER_NETWORK || "studionet";
const demoActor = process.env.DEMO_ACTOR || "";
if (!/^0x[a-fA-F0-9]{40}$/.test(demoActor)) {
  console.error("Set DEMO_ACTOR to the address that acted in the recorded process.");
  process.exit(1);
}
const now = Math.floor(Date.now() / 1000);

function write(method, args, { allowExisting = false } = {}) {
  const command = ["write", contract, method, "--args", ...args.map(String)];
  try {
    const output = execFileSync("genlayer", command, { encoding: "utf8", stdio: "pipe" });
    const status = output.match(/status_name:\s*'([^']+)'/)?.[1] || "submitted";
    console.log(`PASS ${method} (${status})`);
    execFileSync("sleep", ["2"]);
  } catch (error) {
    const text = `${error.stdout || ""}\n${error.stderr || ""}\n${error.message || ""}`;
    if (allowExisting && /already exists|already evaluated|invalid state/i.test(text)) {
      console.log(`SKIP ${method} (already present)`);
      return;
    }
    console.error(`FAIL ${method}\n${text.trim()}`);
    process.exit(1);
  }
}


console.log(`Seeding DAOResolve on ${network}\nContract: ${contract}\n`);
execFileSync("genlayer", ["network", "set", network], { stdio: "inherit" });

const reviewChecks = JSON.stringify([
  {
    check_id: "review",
    kind: "MIN_ELAPSED",
    event_type: "",
    from_event_type: "SUBMITTED",
    to_event_type: "VOTING_STARTED",
    threshold: 172800,
    role: "",
    role_address: "0x0000000000000000000000000000000000000000",
  },
]);
const discussionChecks = JSON.stringify([
  {
    check_id: "discussion",
    kind: "REQUIRED_EVENT",
    event_type: "DISCUSSION_OPENED",
    from_event_type: "",
    to_event_type: "",
    threshold: 0,
    role: "",
    role_address: "0x0000000000000000000000000000000000000000",
  },
]);

write(
  "register_rule",
  [
    "R-REVIEW",
    "Minimum review period",
    "Proposals require at least 48 hours of review between submission and the start of voting.",
    "TIMING",
    "DETERMINISTIC_ONLY",
    reviewChecks,
  ],
  { allowExisting: true }
);
write(
  "register_rule",
  [
    "R-DISCUSSION",
    "Adequate community discussion",
    "Proposals must receive adequate community discussion before a vote. A recorded DISCUSSION_OPENED event is required, and validators may read linked evidence for context.",
    "PROCESS",
    "NEEDS_INTERPRETATION",
    discussionChecks,
  ],
  { allowExisting: true }
);
write(
  "register_rule",
  [
    "R-TREASURY",
    "Treasury proposals use the DAO vote",
    "A proposal involving treasury spending must be handed to the DAO's own vote; the advisory assessment does not replace it.",
    "QUORUM",
    "NEEDS_INTERPRETATION",
    "[]",
  ],
  { allowExisting: true }
);
write("set_category_vote_required", ["QUORUM", "true"], { allowExisting: true });

const proposals = [
  ["P-REVIEW", "https://forum.example.org/t/p-review", "Review period shorter than the rule requires."],
  ["P-DISCUSSION", "https://forum.example.org/t/p-discussion", "Discussion opened and vote not started."],
  ["P-TREASURY", "https://forum.example.org/t/p-treasury", "Treasury transfer proposal."],
  ["P-CONTENT", "https://forum.example.org/t/p-content", "Content moderation policy proposal."],
];
for (const [id, ref, note] of proposals) {
  write("register_proposal", [id, ref, note], { allowExisting: true });
}

const events = [
  ["P-REVIEW", "e1", "SUBMITTED", now - 20000, "https://forum.example.org/t/p-review"],
  ["P-REVIEW", "e2", "VOTING_STARTED", now - 19000, "https://vote.example.org/p-review"],
  ["P-DISCUSSION", "e1", "SUBMITTED", now - 18000, "https://forum.example.org/t/p-discussion"],
  ["P-DISCUSSION", "e2", "DISCUSSION_OPENED", now - 17000, "https://forum.example.org/t/p-discussion"],
  ["P-TREASURY", "e1", "SUBMITTED", now - 16000, "https://forum.example.org/t/p-treasury"],
  ["P-TREASURY", "e2", "VOTING_STARTED", now - 15000, "https://vote.example.org/p-treasury"],
  ["P-CONTENT", "e1", "SUBMITTED", now - 14000, "https://forum.example.org/t/p-content"],
  ["P-CONTENT", "e2", "DISCUSSION_OPENED", now - 13000, "https://forum.example.org/t/p-content"],
];
for (const [proposal, eventId, type, timestamp, ref] of events) {
  write("record_process_event", [proposal, eventId, type, demoActor, timestamp, ref], {
    allowExisting: true,
  });
}

write(
  "open_dispute",
  [
    "D-REVIEW",
    "R-REVIEW",
    "P-REVIEW",
    "Voting started after about 1000 seconds; the rule requires 48 hours of review.",
  ],
  { allowExisting: true }
);
write(
  "open_dispute",
  [
    "D-DISCUSSION",
    "R-DISCUSSION",
    "P-DISCUSSION",
    "The proposal never received adequate community discussion.",
  ],
  { allowExisting: true }
);
write(
  "open_dispute",
  [
    "D-TREASURY",
    "R-TREASURY",
    "P-TREASURY",
    "This treasury proposal requires the DAO's own vote.",
  ],
  { allowExisting: true }
);
write(
  "open_dispute",
  [
    "D-CONTENT",
    "R-CONTENT",
    "P-CONTENT",
    "The content moderation proposal did not record the required disclosure event.",
  ],
  { allowExisting: true }
);

console.log("\nSeed complete. Read back with:");
console.log(`  genlayer call ${contract} list_active_rules --args 0 50`);
console.log(`  genlayer call ${contract} list_disputes --args 0 50`);
console.log("\nThen evaluate the deterministic dispute:");
console.log(`  genlayer write ${contract} evaluate_dispute --args D-REVIEW`);
