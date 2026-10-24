# DAOResolve

**Advisory dispute adjudication for DAOs.** Register a governance rule, record what
actually happened, and let code checks and GenLayer validator consensus assess whether
a proposal followed the rule version it pinned. Every assessment is public, append-only,
challengeable, and clearly labelled as advisory.

Live demo: <https://daoresolve.vercel.app>

Live contract on StudioNet (_current repo deployment_, seeded with the demo rules and disputes):
[`0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd`](https://explorer-studio.genlayer.com/address/0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd)

Official DAO-Resolve.py StudioNet manual deployment:
[`0xc9C3be0b1A5cA36d4c4f54b5d48dEB9834e04Ce3`](https://explorer-studio.genlayer.com/address/0xc9C3be0b1A5cA36d4c4f54b5d48dEB9834e04Ce3)

---

## The trust problem

DAO rules are written in natural language. When someone asks *"did this proposal follow
our review period?"* or *"did the community actually discuss this?"*, the answer is usually
settled informally: by the loudest voice, the admin key, or whoever has patience for the
longest argument.

A single LLM answer is not a fix either. It can be steered, it cannot be audited, and two
runs can disagree without anyone knowing why.

DAOResolve makes the reasoning inspectable:

- the exact rule version is pinned when a dispute opens;
- process events have timestamps, actors, and public source links;
- timing, required events, counts, and required roles are checked in code first;
- only genuinely ambiguous meaning goes to AI-validator consensus;
- evidence links are fetched live by each validator;
- challenges append new rounds instead of overwriting history;
- every assessment says which path decided it, and whether it is final.

**The output is an assessment against a registered rule version. It is not a legal ruling,
not a penalty, and not enforcement.**

## Who it is for

- DAOs whose governance rules already live in prose and public forums.
- Delegates, proposers, and community members who need a shared record of process disputes.
- Governance tooling that wants a read-only advisory signal without handing over control.

## What it is

- A GenLayer Intelligent Contract for rules, proposals, process events, disputes, evidence,
  assessments, challenges, finality, and escalation.
- A recorder CLI that ingests public governance data and produces reproducible event plans.
- A Vue 3 frontend that calls the deployed contract, signs with a wallet, and shows the full
  transaction lifecycle, including failure and retry states.
- Docs, tests, deployment records, and a seed script for a fresh deployment.

## What it is not

- Not a voting or tallying system.
- Not a treasury or fund-moving contract.
- Not a replacement for a DAO's own vote or appeal procedure.
- Not a binding ruling or enforcement mechanism.
- Not a thin LLM wrapper: a failed code check forces `VIOLATION`, and a
  `DETERMINISTIC_ONLY` rule never calls a model.

## How a verdict is made

1. **Process record.** Anyone can register a proposal and append events such as `SUBMITTED`,
   `DISCUSSION_OPENED`, or `VOTING_STARTED`, each with integer UNIX seconds and an
   `evidence_ref` to the authoritative public source. The contract attributes each event to
   the wallet that recorded it; it does not verify that the event happened.
2. **Deterministic checks.** `MIN_ELAPSED`, `REQUIRED_EVENT`, `MIN_COUNT`, and
   `REQUIRED_ROLE` run in plain code against the recorded events. One failed check forces
   `VIOLATION`; the model is never called. `DETERMINISTIC_ONLY` rules stop here.
3. **Interpretation under consensus.** For `NEEDS_INTERPRETATION` rules whose checks pass,
   the leader and every validator independently fetch up to three evidence URLs, build the
   same constrained prompt, and compare *meaning*: verdict, confidence band, and readable
   citations. The reasoning prose and the leader's `web_digest` are not compared.
4. **Challenge and finality.** An `EVALUATED` or `RE_EVALUATED` dispute can be challenged
   inside its pinned window. A re-evaluation appends a new assessment. After the window,
   anyone can finalize, unless the category requires escalation to the DAO's own process.
5. **Escalation.** A vote-required category cannot be finalized. An escalator hands it to
   the DAO and records why. Escalation does not decide anything.

Full split: [docs/design.md](docs/design.md) and [docs/equivalence.md](docs/equivalence.md).

## Honest trust statement

> Proposals and process events can be submitted by any wallet; each event records the
> signer and links to a public source. Validators read evidence URLs live. The contract does
> not independently prove that a recorded event happened unless on-chain event verification
> is enabled for that rule.

Additional limits that are visible in the UI:

- Evidence `side` labels (`DISPUTANT`, `RESPONDENT`, `NEUTRAL`) are **self-declared**. The
  contract records the label; it does not verify identity.
- `web_digest` is leader-asserted and informational. It is not proof.
- An unreadable source cannot support a decisive verdict, but the contract cannot verify
  that readable content is true.
- A wrong verdict that every validator shares is still possible. Consensus is a safety
  mechanism, not omniscience.
- Process events are self-asserted by the wallet that recorded them. The UI shows the
  signer and source, but the contract does not verify that the event happened. Strict
  separation can block that signer from later participating, but it does not verify
  the event itself.
- Assessments are advisory. They never execute, cancel, or reverse governance actions.

## Architecture

```text
┌──────────────────┐     public source (Snapshot, forum, vote page)
│  recorder CLI    │ ────────────────────────────────────────────┐
│  ingest/submit   │  reproducible plan + source timestamps     │
└────────┬─────────┘                                             │
         │ record_process_event                                  │
         ▼                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DAOResolve contract (GenVM, Python)                                │
│  rules v1..vN · proposals · events · disputes · evidence            │
│  deterministic checks ──fail──► VIOLATION (no model call)           │
│          │pass                                                      │
│          ▼                                                          │
│  leader + validators fetch evidence live → compare meaning          │
│  assessments append-only · challenges · finality · escalation       │
└────────┬────────────────────────────────────────────────────────────┘
         │ reads + signed writes (genlayer-js)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Vue frontend                                                       │
│  overview · rules · proposals · disputes · admin · how it works     │
│  read-only without wallet · wallet-signed writes · tx lifecycle     │
└─────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```text
contracts/dao_resolve.py        Intelligent Contract (unchanged baseline)
tests/direct/                   mocked web + LLM tests
tests/integration/              real-consensus gltest scenarios
recorder/                       Snapshot adapter, plan, submit, verify, tests, logs
frontend/                       Vue 3 + Vite + genlayer-js app and tests
scripts/                        deploy, seed, verify
deployments/                    real StudioNet records and schema
docs/                           design, equivalence, threat model, guide, demo, ledger
```

## Quick start

### 1. Contract gates

```bash
pip install genvm-linter genlayer-test
genvm-lint check contracts/dao_resolve.py --json
python3.12 -m pytest tests/direct/ -v
```

The contract is pinned to runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`. Lint reports an
informational notice that a newer runner exists; the pinned runner was accepted by
StudioNet on 2026-10-23 in a fresh deployment (see
[deployments/studionet.md](deployments/studionet.md)).

### 2. Recorder

```bash
npm install
npm run recorder -- ingest snapshot \
  'https://snapshot.box/#/s:ens.eth/proposal/0x943e585d1a4996525c5c7d229401d604ea56fe08c2c9c615c44f048ba42487b7' \
  --proposal-id ENS-7.1

# Inspect the plan under recorder/logs/ENS-7.1.json, then send it:
CONTRACT_ADDRESS=0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2 \
RECORDER_PRIVATE_KEY=0x… \
npm run recorder -- submit recorder/logs/ENS-7.1.json

CONTRACT_ADDRESS=0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2 \
npm run recorder -- verify recorder/logs/ENS-7.1.json
```

`ingest` is a dry run. It fetches the public source, validates chronological order,
rejects future or unsourced events, and writes a reproducible plan. It never invents a
timestamp. The live ENS plan in `recorder/logs/ENS-7.1.json` was submitted and verified
on StudioNet; the three transaction hashes are in the deployment record.

### 3. Frontend

The hosted demo is <https://daoresolve.vercel.app>. To run it locally:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # Vite proxies /api to https://studio.genlayer.com
```

For a production-style local run:

```bash
npm run lint
npm test
npm run build
npm start            # serves dist/ and proxies /api
```

The Studio RPC does not send browser CORS headers. The Vite dev server and
`frontend/server.js` both proxy `/api`; a static-only host needs an equivalent reverse
proxy. This is a deployment requirement, not a mock: the app is reading the real contract
through the proxy.

Mock mode for UI work:

```bash
VITE_MOCK=1 npm run dev
```

Mock mode uses fixtures copied from real StudioNet reads and simulates transaction
lifecycle. It is clearly labelled in the app.

### 4. Deploy and verify

```bash
npm run deploy       # uses the active genlayer CLI account
CONTRACT_ADDRESS=<address> npm run verify
CONTRACT_ADDRESS=<address> DEMO_ACTOR=0x… npm run seed
```

## Demo walkthrough

The deployed StudioNet contract already contains real demo data (read through the real
frontend and captured in [docs/screenshots](docs/screenshots)):

| Case | What it shows |
|---|---|
| `D1` | Deterministic `COMPLIANT`, challenged, re-evaluated; `decided_by = DETERMINISTIC_CHECKS` |
| `D4` | Real validator consensus, `INCONCLUSIVE`, finalized after the challenge window |
| `D3` | Escalated to the DAO's own procedure |
| `D5` | Deterministic `VIOLATION` (`MIN_ELAPSED` failed: no `SUBMITTED` event), then escalated because `TIMING` was vote-required at the time; the policy was restored afterward |
| `ENS-7.1` | Recorder-ingested Snapshot proposal with three sourced events |

A three-minute script with exact clicks and expected copy is in
[docs/demo-script.md](docs/demo-script.md). The captured real-mode pages are
[overview](docs/screenshots/overview-real.png),
[D1](docs/screenshots/dispute-D1-real.png),
[D4](docs/screenshots/dispute-D4-real.png),
[ENS-7.1](docs/screenshots/proposal-ENS-7.1-real.png), the
[browser-write smoke](docs/screenshots/browser-write-real.png), and the hosted
[overview](docs/screenshots/vercel-overview-real.png),
[D1](docs/screenshots/vercel-dispute-D1-real.png), and
[D5](docs/screenshots/vercel-dispute-D5-real.png).

## Testing

Real, current results:

| Gate | Command | Result |
|---|---|---|
| Contract lint | `genvm-lint check contracts/dao_resolve.py --json` | clean, 3 checks passed; 28 methods |
| Direct contract tests | `python3.12 -m pytest tests/direct/ -q` | **171 passed** |
| Integration tests | `gltest tests/integration/ -v -s --network studionet` | **3 passed in 209.37s** (2026-10-23; current source) |
| Recorder typecheck | `npm run typecheck` | clean |
| Recorder tests | `npm run recorder:test` | **8 passed** |
| Frontend lint | `cd frontend && npm run lint` | clean |
| Frontend unit tests | `cd frontend && npm test` | **42 passed** |
| Frontend e2e (mock) | `cd frontend && npx playwright test` | **10 passed**, 4 real-mode tests skipped |
| Frontend e2e (real reads) | `cd frontend && npm run test:e2e:real` | **1 passed, 3 skipped on the unseeded official deployment** against StudioNet |
| Hosted frontend (real reads) | Playwright against `https://daoresolve.vercel.app` | paced run: overview `2 / 3 / 4`, 7 rows; D1 compliant, D5 violation, D4, ENS-7.1; no console errors |
| Browser-wallet write | manual injected EIP-1193 provider | **1 tx FINALIZED** on the fresh deployment; proposal read back |
| Frontend production build | `cd frontend && npm run build` | passes |
| Deployment views | `CONTRACT_ADDRESS=… npm run verify` | 18/18 views passed on the demo address |

The e2e suite needs a Playwright Chromium build. In this environment the cached browser
was older than the package expected, so the run used:

```bash
PLAYWRIGHT_CHROMIUM_PATH=~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
  npx playwright test
```

CI installs the matching browser instead.

## Live deployment

| Item | Value |
|---|---|
| Live frontend | <https://daoresolve.vercel.app> |
| Hosting | Vercel static build plus a same-origin `/api` rewrite to StudioNet |
| Network | StudioNet (gasless), chain id `61999` |
| Demo contract | `0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd` |
| Fresh smoke deployment | `0x1bB0D68FF747f74ACccD1FBb3D992C9B2d23335e` |
| Browser-wallet smoke write | `0x23cc5d6ea3d358bdbb5389353c9efd98bccbab987dc7520d77452ee361e6e2e4` (`FINALIZED`) |
| Schema | `frontend/src/config/schema/dao_resolve.json`, `deployments/studionet.schema.json` |
| Full records | [deployments/studionet.md](deployments/studionet.md) |

Bradbury was not deployed. The only attempt, on 2026-10-19 with account
`0x04e0353b7218b66d6803725ce7342e6e1225db1b` (9.93 GEN), was rejected by the node
with `gas limit too high`; no transaction was confirmed and no funds were spent. The
faucet is browser-based, and no later funded attempt was made. StudioNet is gasless and is
the demo network.

## Frontend routes

`/` overview · `/rules` · `/rules/:ruleId` · `/proposals` · `/proposals/:proposalId` ·
`/disputes` · `/disputes/:disputeId` · `/admin` · `/how-it-works`

The UI shows `submitted → consensus → accepted → finalized` separately, never treats
accepted as final, and renders a failed or undetermined evaluation as its own state with a
retry, not as a verdict.

## Known limitations

- **F2 (contract, deferred):** anyone can fill the 32-slot evidence cap, and evidence sides
  are self-declared. The UI labels sides as self-declared; the contract fix would need a
  failing test first.
- **F3 (consensus, inherent):** noisy evidence or citation choices can cause an
  undetermined evaluation. Nothing is appended; the UI offers retry.
- **F4 (contract, deferred):** URL evidence is truncated from the raw body, so
  markup-heavy pages can lose readable text. A failing fixture test is the next step.
- **F5 (state machine, deferred):** a challenged dispute stays `CHALLENGED` until someone
  calls `re_evaluate`. The UI exposes the permissionless action.
- **No `list_proposals` view:** the frontend discovers proposals from
  `VITE_PROPOSAL_IDS`, and says so on the screen. Nothing is invented.
- **Single-address roles:** the demo uses one account for owner, registrar, and escalator,
  with a separate recorder. The UI shows when roles point at the same address instead of
  pretending separation exists.
- **Static hosting:** the Studio RPC needs a same-origin proxy. `frontend/vercel.json`,
  `frontend/server.js`, and the Vite config provide one.
- **StudioNet rate limit:** the public RPC allows 30 requests per minute. The frontend
  caches reads for 15 seconds, retries once, and shows a retry notice; rapid clicking can
  still hit the limit. The hosted proxy shares Vercel egress, so this is more likely under
  load.

See [docs/threat-model.md](docs/threat-model.md) for the full findings table.

## Roadmap

1. Pilot with one real DAO: their rules, their real process events through the recorder, a
   written case study only with permission.
2. Rule templates for review periods, quorum disclosure, and conflict-of-interest
   disclosure.
3. More source adapters (governance forums, Tally, on-chain governor events).
4. Optional on-chain event verification: fetch the source, extract a fixed fact set, record
   an append-only verification result, never mutate the event.
5. Read-only views and an advisory signal other DAO tooling can display.
6. Replace single-address roles with a DAO-controlled address.

## Credits and license

Contract, recorder, frontend, docs, and tests in this repository. Built for GenLayer.
MIT — see [LICENSE](LICENSE).
