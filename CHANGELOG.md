# Changelog

All notable changes to DAOResolve are recorded here.

## 2026-10-24 (fix: `list_proposals` was unreadable on chain)

DONE:
- Fixed the Proposals screen failing with "Could not load proposals" against every
  StudioNet deployment. `list_proposals` paged `self.proposals`, a `TreeMap[str,
  ProposalRecord]`, with an integer slice, so every call raised
  `TypeError: '<' not supported between instances of 'slice' and 'str'` and reached the RPC
  as `KeyError` / `execution failed`. The view now pages `self.proposal_ids` and looks each
  record up, matching `list_rules` and `list_disputes`.
- Added `tests/direct/test_proposals_registry.py`: empty registry, registration order,
  bounded paging, page-size bounds, per-proposal event counts, and equality with
  `get_proposal`. The view previously had no coverage at all, which is why it shipped broken.
- Fixed `scripts/seed_demo.ts`: it sent the same forbidden `role_address` key the rule form
  did, so every rule carrying a check rolled back and only `R-TREASURY` was registered. It
  also treated an `ACCEPTED` transaction as success even when the contract had rolled back,
  which is how the empty deployment looked seeded. It now reads the receipt, fails on a
  rollback with the contract's message, and treats duplicate registrations as skips.
- Registered the missing `R-CONTENT` rule the seed referenced but never created.
- Redeployed to `0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd` and re-seeded; the frontend
  config, README, and deployment record point at it.

PROOF:
- `python3.12 -m pytest tests/direct/test_proposals_registry.py -v` -> **6 passed** (the
  same tests failed before the fix with the exact slice/str `TypeError`).
- `python3.12 -m pytest tests/direct/ -q` -> **177 passed**.
- `genvm-lint check contracts/dao_resolve.py --json` -> `{"ok":true,...}` (only the
  informational newer-runner notice).
- `genlayer call 0x70bE655a… list_proposals --args 0 50` -> 4 proposals, `event_count: 2`
  each, where the three earlier deployments returned `execution failed`.
- `genlayer call … get_assessment_history --args D-REVIEW 0 10` -> `verdict: 'VIOLATION'`,
  `decided_by: 'DETERMINISTIC_CHECKS'`, `deterministic_fail_count: 1`.

## 2026-10-24 (plain-language copy in place of implementation jargon)

DONE:
- Rewrote the Proposals page notice. It used to explain a contract method name and a build
  variable; it now describes the behavior a visitor can see: every entry is read from the
  chain and verified, and ids that do not exist are skipped, so nothing is invented.
- Removed the remaining implementation details from user-facing copy. "How it works" now
  says "how the verdict was reached" and "web digest" instead of field names, and the
  mock-mode banner no longer asks visitors to edit a build variable.

PROOF:
- `cd frontend && npm test` -> **53 passed (7 files)**. `npm run lint` -> clean.
  `npm run build` -> passes. No `<code>` call or variable names remain in any screen copy.

## 2026-10-24 (fix: register_rule rejected the checks payload)

DONE:
- Fixed `EXPECTED: unknown structured check key` on rule registration. The form sent an
  extra `role_address` field per check, but the contract only accepts `check_id`, `kind`,
  `event_type`, `from_event_type`, `to_event_type`, `threshold`, and `role` (it pins the
  role address itself at registration). The payload is now built by `toContractChecks()`,
  which emits exactly the allowed keys and nothing else, and trims values.
- Added tests asserting the emitted keys are exactly the contract whitelist and that
  `role_address` can never be sent even when present in the form/draft row.

PROOF:
- `cd frontend && npm test` -> **53 passed (7 files)**. `npm run lint` -> clean.
  `npm run build` -> passes. The earlier failed transaction (0x0e4579fb…) rolled back with
  no state change, so the rule can simply be submitted again.

## 2026-10-24 (rule form: explicit validation and correct role enum)

DONE:
- Fixed "Register rule" appearing to do nothing. The clause textarea is required, so with
  an empty clause the browser blocked submit before the app could explain anything — and
  the placeholder text looks like a filled value. The form now uses `novalidate` and a
  shared client-side validator (`src/lib/ruleValidation.js`) that always reports the exact
  missing piece in the page: rule id, title, clause text, category, interpretation, the
  DETERMINISTIC_ONLY "at least one check" requirement, and every incomplete check field.
- The validator mirrors the contract's limits: ids 1-64 characters of letters, digits,
  `- _ . :`; title 120; clause 2000; MIN_ELAPSED/MIN_COUNT thresholds must be positive
  integers; check ids unique within a rule.
- Fixed the REQUIRED_ROLE check values: the contract accepts `RULE_REGISTRAR`, `RECORDER`,
  `ESCALATOR` only, but the editor offered lowercase `owner`/`registrar`/`recorder`/
  `escalator`, which would have been rejected as "unknown role". The editor now uses the
  contract enum values with friendly labels, and previously saved lowercase drafts are
  migrated on load.
- Added `maxlength` to the rule and check inputs to match the contract limits.

PROOF:
- `cd frontend && npm test` -> **51 passed (7 files)** including 9 new validator tests.
  `npm run lint` -> clean. `npm run build` -> passes.

## 2026-10-24 (fix: rules screen froze with an empty rule list)

DONE:
- Fixed the register-rule form becoming unresponsive on a fresh contract. `Rules.vue`
  rendered `emptyCopy.rules` without importing `emptyCopy`, so as soon as the rules list
  was empty (exactly the state of a freshly deployed contract) the render function threw
  `Cannot read properties of undefined (reading 'rules')` and Vue stopped updating the
  screen. The import is restored, and the form submits normally.
- Enabled the `vue/no-undef-properties` ESLint rule for the whole frontend. It catches
  exactly this class of bug (a template referencing an identifier the script never
  defines) and the current codebase passes it cleanly.
- Added a screen regression test that mounts the Rules screen with zero rules and asserts
  the empty state and the enabled submit button both render.

PROOF:
- `cd frontend && npm test` -> **42 passed (6 files)**. `npm run lint` -> clean (now with
  `vue/no-undef-properties`). `npm run build` -> passes.

## 2026-10-24 (wallet chooser: pick from every browser wallet)

DONE:
- Replaced the inline wallet dropdown plus the "Connect <wallet>" button with a single
  **Connect wallet** button that opens a picker listing every browser extension wallet
  detected on the page: MetaMask, Rabby, Brave Wallet, Coinbase Wallet, Trust Wallet,
  OKX Wallet, and any other EIP-6963 or injected provider. Clicking a wallet connects to
  that provider specifically.
- Discovery now rescans when the picker opens (some wallets announce late or are installed
  while the page is open), listens for `ethereum#initialized`, deduplicates providers, and
  names legacy providers with their more specific flags before falling back to
  "Injected wallet".
- Picker behavior: click outside or Escape closes it; the chosen row shows "Connecting…";
  the picker closes only after the wallet returns an account; a failed connection keeps
  the picker open with the error shown beneath the bar. With no wallet installed it shows
  install guidance instead of a disabled button.
- `wallets.js` exports `requestWalletAnnouncements()` for the rescan.

PROOF:
- `cd frontend && npm test` -> **41 passed (5 files)** including 4 new wallet-picker tests
  (list, choose a specific wallet, no-wallet guidance, Escape to close). `npm run lint`
  -> clean. `npm run build` -> passes.

## 2026-10-24 (structured check editor fix)

DONE:
- Fixed the "Add check" button in the rule form doing nothing. `CheckEditor` snapshotted
  the `modelValue` array at mount (`const checks = props.modelValue`), so after the first
  v-model update the editor kept rendering the stale array and no check row ever appeared;
  the same bug affected Remove and kind normalization. The editor now reads the prop
  through a computed getter/setter, which is how v-model updates reach it.
- Added four regression tests: add-and-render, remove, kind-normalization, and in-place
  row edits reaching the parent model.

PROOF:
- `cd frontend && npm test` -> **42 passed (4 files)**. `npm run lint` -> clean.
  `npm run build` -> passes.

## 2026-10-24 (forms are normal page forms, not modals)

DONE:
- Every form is now a normal inline form on the page instead of opening inside a modal
  dialog: register rule, register proposal, record process event, open dispute, challenge,
  escalate, and the admin role / dispute-policy / category / ownership-transfer forms. No
  "open form" button and no cancel button remains; the form is visible where the work
  happens, drafts restore into it on reload, and it submits in place.
- Removed the now-unused `SheetDialog` component and the modal backdrop/panel CSS; the
  challenge and escalate forms reuse the same inline panel style as the evidence form.
- Removed stale `show*` refs and the `showForm`-style open/close plumbing from the four
  screens that used modals; `SheetDialog` is no longer imported anywhere.

PROOF:
- `cd frontend && npm test` -> **42 passed (4 files)**. `npm run lint` -> clean.
  `npm run build` -> passes.

## 2026-10-24 (forms survive reloads and failed signatures)

DONE:
- Every form in the project now keeps its entered values across page refreshes, hard
  reloads, and route navigation, including when a wallet signature is rejected or a
  transaction fails and the user leaves and returns: register rule (including the
  structured checks table), register proposal, record process event, open dispute,
  submit evidence, challenge (reason and evidence rows), escalate, and the admin role,
  dispute-policy, category, and ownership-transfer fields.
- New shared module `frontend/src/lib/formPersistence.js`: drafts save on every change and
  restore on mount, keyed per entity (`dispute:<id>:evidence`, `proposal:<id>:event`, ...)
  so one dispute's evidence never shows on another dispute's screen. On success, forms are
  reset and the draft is deterministically cleared after the watcher flush, so a later edit
  is never swallowed. Defaults may be lazy factories so the event form gets a fresh
  timestamp on reset. Storage falls back gracefully (localStorage -> sessionStorage ->
  in-memory) when storage is blocked; nothing sensitive is ever written there.
- Screens now reset forms via the draft manager (`.reset()` after success, `.keep()` for
  admin policy fields whose live values should stay shown); the ownership-transfer target
  clears on success so a one-click transfer can never be resubmitted accidentally.
- Detail screens remount per route path (`RouterView :key="fullPath"`) so param-only
  navigation between two proposals or disputes can no longer show one entity's draft or
  stale page state on the other entity's screen.
- Draft behavior is covered by unit tests, including the restore-simulated-reload,
  reset-clears-after-flush, no-swallowed-later-edit, keep, factory-defaults, and ref-group
  cases.

PROOF:
- `cd frontend && npm test` -> **42 passed (4 files)** including 8 new formPersistence
  tests. `npm run lint` -> clean. `npm run build` -> passes.

## 2026-10-24 (centered dialogs)

DONE:
- Create flows (register rule, register proposal, record event, open dispute, challenge,
  escalate, withdraw) now open as centered modal dialogs on the page instead of right-side
  sheets. Backdrop centers content, the panel gets rounded borders, internal scrolling, and
  a max height of the viewport minus margin.

PROOF:
- `cd frontend && npm test` -> **42 passed**. `npm run build` -> passes.

## 2026-10-23 (frontend honesty and resilience fixes)

DONE:
- Diagnosed the "Could not load rules" / empty proposals / disabled forms report: the
  StudioNet endpoint had a transient failure while the browser screens loaded, so
  `list_active_rules`, `get_proposal`, and `get_config` all failed through the Vite proxy
  at that moment. Direct RPC and the proxy both return data (2 active rules, P1-P5 and
  ENS-7.1, D1-D5), confirmed with real reads.
- Fixed the role-gate honesty defect: when `get_config` could not be read, `RoleGate`
  claimed "the connected account doesn't hold the role" even for the owner account. It now
  has three honest states: unverified ("Roles couldn't be verified because the network read
  failed. Nothing is wrong with your account." with a Try again button), no wallet, and a
  verified missing role.
- Classified browser network failures (`Failed to fetch`, 502/503/504, `ECONNRESET`, socket
  hang up, and related) as their own error class with a plain "Nothing was changed" message
  instead of the unknown fallback; the classifier (`isNetworkError`) is shared by the error
  map and the read retry so the two can never diverge.
- `reads.js` now retries once on transient network errors (2s) in addition to rate limits
  (4s), so a shared-endpoint hiccup becomes a short delay instead of a broken screen.
- `ErrorNotice` gained an optional retry button; all eight screens that show it are wired to
  their own reload function (Rules, RuleDetail, Proposals, ProposalDetail, Disputes,
  DisputeDetail, Overview, Admin config).
- Changed rule registration to owner or rule registrar only; proposal, event, and dispute
  creation remain open to any wallet. Event writes now tolerate CLI address encoding.
- Redeployed the demo contract as `0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2` and seeded
  D1-D5, ENS-7.1, assessments, challenges, finalization, withdrawal, and escalation.

PROOF:
- `cd frontend && npm test` -> **42 passed** (4 files; 8 formPersistence, 11 review-fix regressions).
- `cd frontend && npm run lint` -> clean.
- `cd frontend && npm run build` -> passes.
- Live reads through the Vite `/api` proxy: `get_config` and `list_active_rules` return
  real data; 10-request parallel burst returns 200 for all.

NEXT: reload the app with a wallet on StudioNet; the deployer account `0x5B36…4c89` holds
owner and registrar, so both forms unlock once config loads.

BLOCKED: none.

## 2026-10-23 (pre-submit review fixes)

DONE:
- Corrected the D5 evidence record: the on-chain assessment is `VIOLATION` because
  `MIN_ELAPSED` failed with `missing from_event=SUBMITTED` (`P5` has no events), not
  `COMPLIANT`. Updated the deployment record, changelog, README, and demo script.
- Reconciled the Bradbury status: the 2026-10-19 attempt with `0x04e0…db1b` (9.93 GEN)
  was rejected by the node with `gas limit too high`; the README and API ledger no longer
  claim an empty account was the reason.
- Fixed `AssessmentPanel`: a `COMPLIANT` deterministic assessment now gets the compliant
  notice class and copy, not the red violation style. Added two unit regressions.
- Forms now stay open when a transaction is rejected, reverted, or fails consensus, so the
  entered data is not lost. Applies to rule registration, proposal registration, process
  events, and dispute opening.
- Scoped "no console errors" to the paced hosted read run and documented StudioNet's
  30-requests-per-minute limit in the README limitations.
- Labeled the second integration test table by date.
- Added the concurrent frontend resilience pass: browser/network failures get an honest
  message instead of a user-blaming one, reads retry once on a transient network error,
  error notices offer a retry, and role gates distinguish "roles could not be verified"
  from "this account lacks the role".

PROOF:
- `cd frontend && npm test` -> **42 passed**.
- `cd frontend && npm run lint` -> clean.
- `cd frontend && npx playwright test` -> **10 passed**, 4 real-mode tests skipped.
- `cd frontend && npm run build` -> passes.
- `python3.12 -m pytest tests/direct/ -q` -> **171 passed**.
- `gltest tests/integration/ -v -s --network studionet` -> **3 passed in 261.76s**.
- Live `get_dispute D5` confirms `VIOLATION`, `deterministic_fail_count: 1`,
  `detail: missing from_event=SUBMITTED`.
- Hosted corrected build: overview `2 / 3 / 4` and 7 rows; `D1` shows one compliant
  notice and zero violation notices; `D5` shows one violation notice and the failed-check
  detail; `D4` and `ENS-7.1` render; no console errors in the paced run.

NEXT: Run the second strict review pass, then exercise the MetaMask extension, record the
demo video, and prepare public post drafts.

BLOCKED:
- MetaMask extension UX: not installed in this environment.
- Bradbury: the node rejects the current deploy with `gas limit too high`; no funded retry
  has succeeded.
- Demo video and public posts: user-owned publishing steps.

## 2026-10-23 (hosted frontend on Vercel)

DONE:
- Added `frontend/vercel.json`: same-origin `/api` rewrite to StudioNet, SPA fallback,
  and `no-store` headers for JSON-RPC responses.
- Deployed the production frontend to <https://daoresolve.vercel.app>.
- Verified the hosted app with Playwright against the live contract: overview metrics
  `2 / 3 / 4`, 7 rows, no alerts; `D1`, `D4`, and `ENS-7.1` all render; no page or
  console errors.
- Confirmed the hosted `/api` endpoint returns `200` with a real `get_config` read and
  does not rely on Studio's cross-origin redirect.
- Updated the README, submission notes, deployment record, API ledger, screenshots,
  testing notes, and frontend README with the live URL.

PROOF:
- Live URL: <https://daoresolve.vercel.app>
- Vercel deployment: `dpl_6QBeKa7rbGsB3bCNma2ndTJuWjrG` (final build; earlier
  corrected build `dpl_94ZdDfdRUHRjWRT2EwK6C93T1qzg`, initial `dpl_3Diz8bYmaA9Cku5vEGdbXv5cjSom`)
- Proxy check: `POST /api` -> `200`, `{"jsonrpc":"2.0","result":"0xf22f","id":1}`
- Screenshots: `docs/screenshots/vercel-overview-real.png`,
  `docs/screenshots/vercel-dispute-D1-real.png`.
- `gltest tests/integration/ -v -s --network studionet` -> **3 passed in
  261.76s** on 2026-10-23, with the contract source unchanged.

NEXT: Exercise the MetaMask extension UX, record the demo video, prepare public post
drafts, and run the M11 pre-submit review passes.

BLOCKED:
- MetaMask extension: not installed in this environment; the injected EIP-1193 provider
  covers the genlayer-js wallet path but not the extension UI.
- Bradbury: no funded account; the faucet is browser-based.
- Demo video and public posts: user-owned publishing steps.

## 2026-10-23 (browser-wallet smoke and transaction tray fix)

DONE:
- Exercised the real browser write path in Chromium with a temporary injected
  EIP-1193 provider backed by the unlocked owner account. No key was added to
  the frontend, repository, or screenshots.
- Registered `E2E-BROWSER-2` on the fresh StudioNet deployment
  `0x1bB0D68FF747f74ACccD1FBb3D992C9B2d23335e`; the UI reached `FINALIZED` and
  the contract read the proposal back.
- Fixed the transaction tray so the previous consensus status (`PENDING` /
  `COMMITTING`) is cleared when a transaction becomes accepted or finalized.
- Added a mock e2e regression assertion for the stale-status bug.
- Documented the write receipt, the injected-provider scope, and the remaining
  MetaMask-extension gap.

PROOF:
- Browser write tx:
  `0x23cc5d6ea3d358bb5389353c9efd98bccbab987dc7520d77452ee361e6e2e4`,
  `FINALIZED`, five `agree` votes, no page errors.
- `get_proposal E2E-BROWSER-2` returned the expected content and
  `created_by = 0x5B3661C576c7001e6d6279C67F3779705d334c89`.
- `cd frontend && npm run lint` -> clean.
- `cd frontend && npm test` -> **14 passed**.
- `cd frontend && npx playwright test` -> **10 passed**, 4 real-mode tests skipped.
- `cd frontend && npm run build` -> passes.
- Screenshot: `docs/screenshots/browser-write-real.png`.

NEXT: Host the frontend with a same-origin `/api` proxy, exercise the MetaMask
extension UX, record the demo video, and update `SUBMISSION.md` with the live
URL.

BLOCKED:
- MetaMask extension UX: the provider path is verified, but no extension is
  installed in this environment.
- Public hosting has no URL yet.
- Bradbury still has no funded account; the faucet is browser-based.
- Demo video and public posts are user-owned publishing steps.

## 2026-10-23 (full project pass: frontend, recorder, docs, fresh deploy)

DONE:
- Built the Vue 3 frontend in `frontend/`: overview, rules, proposals, disputes,
  admin, how-it-works, wallet bar, process rail, assessment history, evidence,
  challenges, finality banner, role gates, transaction lifecycle, and an
  evaluation-failure notice with retry.
- Added a same-origin Studio RPC proxy (`frontend/server.js` and Vite config)
  because direct browser calls are blocked by CORS. Added read caching and a
  rate-limit retry.
- Added mock mode with real StudioNet fixtures and simulated transaction
  lifecycle, clearly labelled in the UI.
- Built the recorder CLI in `recorder/`: Snapshot GraphQL adapter, reproducible
  plan, validation, dry-run `ingest`, `submit`, `verify`, tests, and a real ENS
  ingest plan (`ENS-7.1`).
- Added `scripts/deploy.sh`, `scripts/seed_demo.ts`,
  `scripts/verify_deployment.ts`, and root typecheck/recorder scripts.
- Added `SUBMISSION.md`, `docs/api-ledger.md`, `docs/guide-for-daos.md`,
  `docs/demo-script.md`, recorder README, and CI workflow.
- Reassigned the demo contract recorder to a separate address
  `0x84a0cB58d217b08ed95b540b7D3ABdC5bBA3443C`, submitted the ENS plan, and
  verified all three events.
- Deployed the current source fresh to StudioNet to prove the pinned runner is
  accepted: `0x1bB0D68FF747f74ACccD1FBb3D992C9B2d23335e`.

PROOF:
- `genvm-lint check contracts/dao_resolve.py --json` -> clean, 3 checks passed,
  28 methods.
- `pytest tests/direct/ -q` -> **171 passed**.
- `gltest tests/integration/ -v -s --network studionet` -> **3 passed in
  209.44s** (2026-10-20 record; contract unchanged).
- `npm run typecheck` -> clean.
- `npm run recorder:test` -> **8 passed**.
- `cd frontend && npm run lint` -> clean.
- `cd frontend && npm test` -> **14 passed**.
- `cd frontend && npx playwright test` -> **10 passed** (mock mode; 4 real-mode
  tests skipped).
- `cd frontend && npm run test:e2e:real` -> **4 passed** against the deployed
  StudioNet contract (overview, D1, D4, ENS-7.1).
- `cd frontend && npm run build` -> passes.
- Real-mode Playwright read check -> metrics `2 / 3 / 4`, 7 dispute rows,
  D1 assessment rendered, no page errors.
- Recorder txs: `0x9e3173c0…`, `0x87dcb6da…`, `0x67d42def…`; verify printed
  `Verified 3 events for proposal ENS-7.1.`
- Fresh deploy tx: `0xc500a184…`, `FINALIZED`, `MAJORITY_AGREE`.

NEXT: Host the frontend on a Node host with the `/api` proxy, run one real
browser-wallet write on StudioNet, record the demo video, and update
`SUBMISSION.md` with the live URL.

BLOCKED:
- No browser wallet in this environment, so the real wallet-signing lifecycle is
  implemented and mock-tested but not exercised end to end here.
- Bradbury still has no funded account; the faucet is browser-based. StudioNet
  is the demo network.
- At that point the frontend was not hosted; the deployable server was
  `frontend/server.js`.

## 2026-10-20 (every public method exercised on the official deployment)

DONE:
- Ran all 16 write methods and all 12 read methods of `dao_resolve.py` against
  the official StudioNet deployment
  `0xb4d8bf96a4E5E576c474741879B0E4D5cd6FbEcb` from the owner account
  `0x5B3661C576c7001e6d6279C67F3779705d334c89` (41 transactions recorded).
- Drove five disputes through the real state machine: `D1` open → evaluate →
  challenge → re-evaluate (`RE_EVALUATED`), `D2` open → withdraw (`WITHDRAWN`),
  `D3` open → escalate (`ESCALATED`), `D4` open → evaluate → challenge →
  re-evaluate → finalize (`FINALIZED`), `D5` open → evaluate → finalize
  (blocked) → escalate (`ESCALATED`).
- Confirmed both decision paths on chain: `D1#a1`/`D1#a2` returned
  `decided_by: 'DETERMINISTIC_CHECKS'` with `verdict: 'COMPLIANT'` and
  `detail: 'elapsed=100 threshold=100'`; `D5#a1` returned the same decision
  source with `verdict: 'VIOLATION'` because `MIN_ELAPSED` failed with
  `missing from_event=SUBMITTED` (`P5` has no events). `D4#a1`/`D4#a2`
  returned `decided_by: 'INTERPRETATION'` with `verdict: 'INCONCLUSIVE'`,
  because two contradictory text statements cannot prove that discussion
  occurred.
- Verified the citation behaviour under real consensus: `D4#a1` cited no
  evidence ids and recorded `web_digest: 'D4#e1=41:No forum thr;D4#e2=65:A
  forum thre'`; after the challenge added `D4#e3`, the re-evaluation cited
  `D4#e1`, `D4#e2`, and `D4#e3`. Evaluate took 29.2s, re-evaluate 23.6s.
- Verified the two guard rails by their rollback payloads rather than by
  reading the source: `finalize_dispute D5` in a vote-required `TIMING`
  category returned `EXPECTED: category requires escalation to the DAO
  procedure`, and `open_dispute D6` on the deprecated `R1` returned
  `EXPECTED: rule is deprecated`. Both left state unchanged.
- Restored policy afterwards: `challenge_window: 86400`, `max_challenge_rounds:
  3`, `vote_required_categories: []`, ownership unchanged. `R1` stays
  deprecated by design; `R2` remains active.
- Recorded the whole run, with all 41 transaction hashes and the read outputs,
  in `deployments/studionet.md`; updated `README.md`, `docs/deployment.md`, and
  `docs/testing.md` to match. No private key or keystore material was written
  to the repository, and the temporary CLI account was locked and removed after
  the run.

PROOF:
- 41 writes, every one with a real hash on chain; read-back after the run shows
  `D4` `FINALIZED` with `final_assessment_id: 'D4#a2'`, `D3`/`D5` `ESCALATED`,
  `D2` `WITHDRAWN`, `D1` `RE_EVALUATED`, and `D6` absent.
- `get_evidence D4 0 5` -> `D4#e1` DISPUTANT, `D4#e2` RESPONDENT, `D4#e3`
  RESPONDENT (the challenge-added item).
- `get_rule R1` -> `status: 'DEPRECATED'`; `list_active_rules` -> `R2` only.

NEXT:
- Nothing pending on chain. Re-deprecate or re-register rules only if the demo
  state should be reset for a different narrative.

BLOCKED:
- A non-owner caller rejection could not be exercised on this address: the run
  used a single key, so an unauthorised write would only prove that the CLI
  signs with the same account. Covered by `tests/direct/test_access_control.py`.
- `transfer_ownership` was executed with the current owner as the new owner. A
  handoff to a different address was not performed, because it would move
  control of the official deployment irreversibly to an account whose key is
  not available.

## 2026-10-20 (official StudioNet deployment recorded)

DONE:
- Recorded the official StudioNet deployment
  `0xb4d8bf96a4E5E576c474741879B0E4D5cd6FbEcb`, deploy transaction
  `0xa99453271c7139fcdda8480e6050ae8bd623b55f9dc5020a755c610227cf146f`
  (`FINALIZED`, execution mode `NORMAL`, 5 validators, 0 rotations).
- Verified the deployment rather than trusting the address: the stored code was
  downloaded through `gen_getContractCode`, base64-decoded, and hashed. It is
  byte-identical to `contracts/dao_resolve.py` (both
  `f0a4abc1812e8d37…`, 1,463 lines), so the `web_digest`, readable-citation
  floor, and derived `decided_by` field are live on chain.
- Documented the on-chain state honestly: the deploy is the address's only
  transaction, so the instance is fresh (0 rules, 0 disputes). Read back
  `get_config` (`challenge_window: 86400`, `max_challenge_rounds: 3`,
  owner/registrar/recorder/escalator all
  `0x5B3661C5…4c89`), plus `list_active_rules` and `list_disputes` (both `[]`).
- Regenerated `deployments/studionet.schema.txt` from the official address
  (242 lines, 12 read + 16 write methods).
- Updated `README.md`, `docs/deployment.md`, `docs/design.md`,
  `docs/testing.md`, `deployments/README.md`, and `deployments/studionet.md` to
  point at the official address, with the earlier instance `0xDD29Ae63…`
  retained as a clearly labelled receipt trail for the write flow.
- Documented two Studio-side failures seen while verifying, so they are not
  mistaken for contract faults: Studio's UI sends `gen_getContractCode` an
  object parameter (`[{"contractAddress": …}]`), which the node rejects with
  `(psycopg2.ProgrammingError) can't adapt type 'dict'`; the same call with a
  plain string works. Simulation-mode deployments never reach chain and appear
  as `Contract 0x… not found`.

PROOF:
- `gen_getContractCode` round trip: `identical: True`, deployed and local
  SHA-256 both `f0a4abc1812e8d37354baee25ffcf40d47fb70a577003a2099cefd7e1636fe6a`.
- `genlayer schema 0xb4d8bf96…` -> 242-line schema, exit 0.
- `genlayer call 0xb4d8bf96… get_config` -> config above, exit 0;
  `list_active_rules --args 0 10` and `list_disputes --args 0 10` -> `[]`.
- Explorer API reports `tx_count: 1`, status `FINALIZED`.

NEXT:
- Seed a rule and a dispute on the official address from the owner account if a
  live demo state is wanted; that requires the owner key and is not done here.

BLOCKED:
- Nothing blocked for this record. Bradbury remains blocked by the node-side
  gas-limit rejection.

## 2026-10-20 (fifth review response)

DONE:
- Checked an external pros/cons review against the current source. Most of its
  findings were already closed: `MIN_ELAPSED` evaluates every matching interval
  (`pairs=N`), `REQUIRED_ROLE` pins the role address per rule version, prompt
  event truncation is reported with totals and type counts, `claim_text` is
  labelled unverified and cannot be cited, page drift is tested, failed
  consensus is distinguished from `INCONCLUSIVE`, and two sample DAOs are
  documented.
- Fixed the two findings that were still open:
  - **Citations proved an id, not support (review items: "evidence citations do
    not guarantee evidence quality", "external evidence can be unstable")** —
    each interpretation run now rejects a decisive verdict that cites only
    evidence it could not read (`LLM_ERROR: decisive verdict cites no readable
    evidence`), and consensus requires a shared citation that **both** runs
    could read. `INCONCLUSIVE` stays exempt, because a finding of insufficiency
    may rest on unreadable sources. This closes the case where a verdict cites
    a URL that returned 503 and still looks sourced.
  - **Failed check versus governance violation (review item: "a deterministic
    failure automatically means VIOLATION")** — every assessment now reports
    `decided_by`: `DETERMINISTIC_CHECKS` when a check failed or the pinned rule
    is `DETERMINISTIC_ONLY`, otherwise `INTERPRETATION`. It is derived at read
    time from the recorded fail count and the pinned rule version, so it cannot
    drift from the stored checks and needs no new storage.
- Prompt changes: a decisive verdict may not cite evidence marked
  `available="false"`; during re-evaluation the prior assessment is labelled a
  prior opinion rather than ground truth, so a persuasive challenge can correct
  it without the model deferring to its earlier answer.
- Documentation: `docs/equivalence.md` (readability invariant and failure
  behavior), `docs/threat-model.md` (new "unsupported but well-formed
  citations" threat), `docs/design.md`, `docs/domain-model.md`, `docs/api.md`,
  `docs/testing.md`, `docs/deployment.md`, and `README.md`.
- Contract: 1,463 lines, lint clean (3 checks, 28 methods, 16 write / 12 view).

PROOF:
- `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/dao_resolve.py --json`
  -> `{"ok":true,"lint":{"ok":true,"passed":3},"validate":{"ok":true,...}}`
  (28 methods, 1,463 lines).
- `python3.12 -m pytest tests/direct/ -q` -> `171 passed in 5.89s` (4 new tests:
  decisive verdict citing only unreadable evidence rejected; evidence readable
  in only one run rejected; `INCONCLUSIVE` exempt from the readability floor;
  end-to-end rejection stores nothing and leaves the dispute `OPEN`).
- `gltest tests/integration/ -v -s --network studionet` -> `3 passed in 209.44s`
  against the current source. On-chain read-back shows
  `decided_by: 'INTERPRETATION'` for `D2#a1`/`D2#a2` and
  `decided_by: 'DETERMINISTIC_CHECKS'` for `D1#a1`; consensus was reached under
  the readability floor without retries. Test contract addresses and hashes are
  in `deployments/studionet.md`.

NEXT:
- Redeploy the canonical contract to StudioNet, then refresh
  `deployments/studionet.md` and `deployments/studionet.schema.txt`.

BLOCKED:
- The canonical StudioNet deployment
  (`0xDD29Ae63f12Fbb586551251eDeb94B51aC666DfA`) still runs the previous source.
  The integration suite exercised the current source on throwaway deployments,
  so the on-chain code at that address does not match the working tree until
  redeployment.

## 2026-10-20 (fourth review response)

DONE:
- Worked through an external code review of the contract and closed the
  findings that were still open:
  - **External evidence drift (review item: "External URLs are fetched
    separately during interpretation")** — every assessment now stores
    `web_digest`: a bounded (512 char) fingerprint of the evidence the leader
    actually read (`evidence_id=length:prefix`, or `evidence_id=UNAVAILABLE`).
    It is an audit artifact, not a consensus input, and it is HTML-escaped so
    it can never break out of a delimiter. Leader and validator still fetch
    independently, so the fingerprint makes divergence visible instead of
    hiding it. Documented in `docs/equivalence.md`, `docs/design.md`, and
    `docs/threat-model.md`.
  - **Adversarial challenge tests (review item: "Challenges do not necessarily
    resolve the original problem")** — new direct tests cover a challenge with
    no reason and no evidence (rejected), irrelevant challenge evidence (a
    deterministic verdict is unchanged and no model is called), contradictory
    evidence (re-evaluation can end `INCONCLUSIVE`), and a persuasive
    correction (re-evaluation can flip the verdict while the first assessment
    stays in history).
  - **Page drift between fetches (review item: "test the behavior when the two
    interpretations receive different external responses")** — two new tests
    swap the web mock between the leader's fetch and the validator's re-fetch:
    the same verdict under changed content still reaches consensus, a changed
    verdict under changed content is rejected.
  - **Failed consensus is not an inconclusive verdict (review item 2)** — a new
    test shows a failed evaluation stores nothing, leaves the dispute `OPEN`,
    and a later `evaluate_dispute` succeeds. Documented in README and
    `docs/equivalence.md`.
  - **Zero-evidence decisive verdicts (review item: "decide whether that is
    intentional")** — the policy is now explicit and tested: with no evidence
    ids at all, citing the pinned rule is sufficient, because recorded events
    can decide an interpretive clause. When evidence ids exist, a decisive
    verdict must cite one and leader and validator must share a cited id.
  - **Reuse (review item: "at least two sample DAO rules and example
    disputes")** — `docs/examples.md` now walks through two complete sample
    DAOs (a grants council with quorum and community-discussion rules, and a
    treasury payments DAO with timing and disclosure rules), each with the
    expected assessment, the challenge outcome, and the escalation path.
  - **README** rewritten against the real repository state: a "How consensus is
    used" section, the reuse section, verified status, and the removal of
    links to documents that do not exist.
- Contract stays within the 1,400-line budget: 1,397 lines, lint clean
  (3 checks, 28 methods, 16 write / 12 view).

PROOF:
- `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/dao_resolve.py --json`
  -> `{"ok":true,"lint":{"ok":true,"passed":3},...}` (28 methods, 1,397 lines).
- `pytest tests/direct/ -q` -> `167 passed in 6.05s`.
- `gltest tests/integration/ -v -s --network studionet` -> `3 passed in 270.07s`.
- Redeployed to StudioNet: contract
  `0xDD29Ae63f12Fbb586551251eDeb94B51aC666DfA`, deploy tx
  `0x3157b6a8137b74a162afcfbb288da91bd635062e0d7feaac60179aa3762c9f66`
  (receipt `FINALIZED`, `MAJORITY_AGREE`). Schema saved to
  `deployments/studionet.schema.txt` (242 lines).
- On-chain evidence for the new field: dispute `D2` on the deployed contract
  stored `verdict: 'INCONCLUSIVE'`, `cited_evidence_ids: [ 'D2#e1' ]`,
  `web_digest: 'D2#e1=3012:&lt;!DOCTYPE ht'`; the deterministic dispute `D1`
  stored `web_digest: ''` and finalized with `final_assessment_id: 'D1#a1'`.
- Real consensus under the integration suite stored
  `web_digest: 'D2#e1=189:The DAO foru;D2#e2=63:The author r'` on the
  re-evaluation.

NEXT:
- Optional: retry Bradbury or Asimov with a funded account and faucet claim.

BLOCKED:
- Bradbury testnet deploy attempt rejected by the node with `gas limit too high`
  (`eth_sendRawTransaction`); no transaction was confirmed and no funds were
  spent. StudioNet remains the verified public deployment.

## 2026-10-19 (third review response)

DONE:
- Addressed the third external review's highest-value findings:
  - `MIN_ELAPSED` now checks every `to_event_type` against the latest
    preceding `from_event_type` and passes only when every interval meets the
    threshold. A vote recorded before any submission fails explicitly; the
    detail reports `pairs=N` for multi-interval cases.
  - `REQUIRED_ROLE` now pins the role address in the rule version at
    registration time. Rotating a role no longer reinterprets old events;
    publish a new rule version to adopt a new address. A rule registered while
    a role was unset stays failed until a new version is published.
  - Validator consensus now requires leader and validator to share at least one
    cited evidence id for a decisive verdict, so two runs cannot agree while
    relying on disjoint evidence.
  - The prompt labels `claim_text` as the disputant's unverified assertion and
    reports total, shown, truncation, and event-type counts for events.
  - Deterministic reasoning now states that it is an assessment against the
    registered rule version, not a finding about the whole process.
- Documentation: design, equivalence, threat model, README, and deployment record
  refreshed for the new semantics, citation limits, role pinning, and omitted-event
  reporting.
- Contract: 1,395 lines, lint clean (3 checks, 28 methods, 16 write / 12 view).
- Direct tests: 157 passed. New tests cover repeated voting starts, latest-preceding
  submission, vote before submission, role pinning and rotation, zero-role pinning,
  disjoint/overlapping evidence citations, claim unverified prompt text, and
  truncated-event reporting.
- Integration tests: 3 passed on StudioNet (consensus round trip, end-to-end
  deterministic evaluation, invalid transition).
- Redeployed to StudioNet: `0xbc0B3C5286e36162e7535480BAB9E0733D1aFFBd`,
  deploy tx `0xcdd69d54388ca823fb4744111e9f84efee2c5314991bf08c5549b6227c1d97ab`.
  Schema saved to `deployments/studionet.schema.txt` (239 lines). A write flow
  (set_config, register_rule, register_proposal, record events, open_dispute,
  evaluate_dispute) returned `MAJORITY_AGREE`; read-back shows `COMPLIANT` with
  `elapsed=100 threshold=100`.

PROOF:
- `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/dao_resolve.py --json`
  -> `{"ok":true,"lint":{"ok":true,"passed":3},...}` (28 methods, 1,395 lines).
- `pytest tests/direct/ -q` -> `157 passed in 5.87s`.
- `gltest tests/integration/ -v -s --network studionet` -> `3 passed`.
- StudioNet deploy tx
  `0xcdd69d54388ca823fb4744111e9f84efee2c5314991bf08c5549b6227c1d97ab`;
  contract `0xbc0B3C5286e36162e7535480BAB9E0733D1aFFBd`; read-back
  `status: EVALUATED`, `verdict: COMPLIANT`, `detail: elapsed=100 threshold=100`.

NEXT:
- Optional: retry Bradbury or Asimov with a funded account and faucet claim.

BLOCKED:
- Bradbury testnet deploy attempt rejected by the node with `gas limit too high`
  (`eth_sendRawTransaction`); no transaction was confirmed and no funds were
  spent. StudioNet remains the verified public deployment.

## 2026-10-19

DONE: Completed the standalone GenLayer Intelligent Contract and the M1–M9
deliverables:

- Contract with role-based administration, versioned rules, proposal events,
  disputes, evidence, deterministic checks, custom leader/validator consensus,
  challenges, re-evaluation, finality, and escalation.
- Direct test suite covering rules, disputes, evaluation, parsing, challenges,
  access control, equivalence helpers, and web evidence.
- Integration tests exercising real consensus on StudioNet.
- Design, domain model, state machine, access control, limits, API, equivalence,
  threat model, examples, testing, deployment, and glossary documentation.
- StudioNet deployment record with schema, transaction hashes, and explorer
  links. The record covers an earlier deployed revision; the current working
  tree contains later changes that are tested but not redeployed.
- Bradbury attempt documented as blocked by a node-side gas-limit rejection.

PROOF:

- `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/dao_resolve.py --json`
  -> clean, 3 checks passed.
- `python3.12 -m pytest tests/direct/ -q` -> **157 passed in 5.77s**.
- `gltest tests/integration/ -v -s --network studionet` -> **3 passed in
  243.40s**, as recorded in `deployments/studionet.md`.
- StudioNet contract:
  `0x48179D48495B7199a3FCb939c3f0F73a23c50b70`.
- Explorer:
  https://explorer-studio.genlayer.com/address/0x48179D48495B7199a3FCb939c3f0F73a23c50b70

NEXT: Optional Bradbury retry once the node gas limit or runner revision allows
the deployment; otherwise the required StudioNet deployment is complete.

BLOCKED: Bradbury returns `gas limit too high` from the node before confirmation.
No funds were spent. See `deployments/bradbury.md`.
