# StudioNet Deployment Record

## Current deployment (`0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd`)

**Status: current — use this one.** Deployed on 2026-10-24 from
`contracts/dao_resolve.py` after fixing `list_proposals`.

| Item | Value |
|---|---|
| Contract address | `0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd` |
| Deploy transaction | `0x7078a36ef1352012fef303e3811298c671b5606bba8b434ad73b174d2cfd4ce3` |
| Deploy status | `ACCEPTED`, 5 validators, 3 `AGREE`, 2 idle |
| Deployer / owner | `0x5B3661C576c7001e6d6279C67F3779705d334c89` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Explorer | https://explorer-studio.genlayer.com/address/0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd |
| Studio import | https://studio.genlayer.com/?import-contract=0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd |

### Real consensus run on live evidence (`D-ENS-PRICING`)

This is the case that demonstrates the interpretive path against a real public source
rather than a placeholder:

| Item | Value |
|---|---|
| Proposal | `ENS-PRICING` |
| `content_ref` | https://discuss.ens.domains/t/22506.json |
| Source | ENS DAO forum, topic 22506, `[Temp Check] Removing the price cliffs in ENSv2 pricing` |
| Events | `SUBMITTED` at `1792586617`, `DISCUSSION_OPENED` at `1792598645` (both the thread's real post timestamps) |
| Dispute | `D-ENS-PRICING` against `R-DISCUSSION` v1 |
| Evidence | `D-ENS-PRICING#e1`, side `NEUTRAL`, kind `URL` |
| Evaluate transaction | `0xaf544f0a5b9466b313c38ff408877b44a0a6665c048f2026f0511d4f9397efc9` |
| Validator votes | 3 `AGREE`, 2 `IDLE` |
| Verdict | `COMPLIANT`, band `MEDIUM` |
| Decided by | `INTERPRETATION` (validator consensus), not code |
| Deterministic checks | 1 pass: `REQUIRED_EVENT discussion — count=1` |
| Cited | clause `R-DISCUSSION`, evidence `D-ENS-PRICING#e1` |
| `web_digest` | `D-ENS-PRICING#e1=3012:{"post_strea` — 3012 characters were read, so the live fetch succeeded |

The `web_digest` prefix is the only place the fetch result is visible from outside, and it
is leader-asserted: it shows the page was read, not that the content is true. The
`.json` view of a Discourse thread was chosen deliberately — a rendered HTML page would
spend most of the 3,000-character window on markup (finding F4), while this endpoint
returns the proposal text and replies at the top of the body.

Event actors are the recorder address, not the forum authors. The forum gives us their
handles (clowes.eth, nick.eth, raffy, stevegachau.eth) but no chain addresses, so the
contract records who asserted the event, not who spoke.

Seeded demo data (all verified by reading the contract back):

- Rules `R-REVIEW`, `R-DISCUSSION`, `R-TREASURY`, `R-CONTENT`
- Proposals `P-REVIEW`, `P-DISCUSSION`, `P-TREASURY`, `P-CONTENT`, 2 events each
- Proposals `P-REVIEW` through `P-CONTENT` use `forum.example.org` placeholder links;
  `ENS-PRICING` is the only proposal backed by a real public source
- Disputes `D-REVIEW` and `D-CONTENT` evaluated: `VIOLATION`, `decided_by =
  DETERMINISTIC_CHECKS`, 1 failed check each, no model call
- Dispute `D-ENS-PRICING` evaluated by validator consensus on live evidence: `COMPLIANT`,
  band `MEDIUM` (details above)
- Dispute `D-DISCUSSION` evaluated by consensus with no evidence submitted: `COMPLIANT`,
  band `HIGH`, `cited_evidence_ids: []`, `web_digest: ''`. The verdict rests entirely on
  the recorded `DISCUSSION_OPENED` event, so it is the weakest case in the deployment and
  is presented as such rather than as an example of evidence-based assessment
- Dispute `D-TREASURY` left `OPEN` (vote-required category, only escalatable)

### Repeated consensus runs (`M-ENS-20261025-*`)

To turn one lucky run into a rate, `scripts/measure_consensus.mjs` repeats the same
question eight times: same rule version (`R-DISCUSSION` v5, `NEEDS_INTERPRETATION`), same
proposal (`ENS-PRICING`), same evidence URL, same claim. Each run is a fresh dispute, so
each `evaluate_dispute` is an independent consensus round.

| Dispute | Validator votes | Rotations | Verdict | Evaluate transaction |
|---|---|---|---|---|
| `M-ENS-20261025-2` | 3 `AGREE` / 1 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x7313454fd1c41a6666cd3a5b6f50fd5686d2b4a8030f174023c7bb90b3f6c5cb` |
| `M-ENS-20261025-3` | 2 `AGREE` / 2 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x8863fa07da84b1568e3721963564d4af22932c1294de58062a337e078ff7f72d` |
| `M-ENS-20261025-4` | 2 `AGREE` / 2 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x5bbf8b0fc17aa570bdcbd4c3e66a0659ca84d812665292a05bb6ee25b314761e` |
| `M-ENS-20261025-5` | 3 `AGREE` / 1 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x1b114519e7b15e4b5668363bb92f02e3b8bb0ccf0df8bdbec31517e0cdb173b5` |
| `M-ENS-20261025-6` | 2 `AGREE` / 2 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x46124579cef879724441f89b48ba24d488cd5e705055e1fee764e4f38106ac10` |
| `M-ENS-20261025-7` | 3 `AGREE` / 1 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0xe8665db9e7b24eba02ebccf7d8cffc0508a35b841a0cc55cf32e4e8b4441e20c` |
| `M-ENS-20261025-8` | 2 `AGREE` / 2 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x07bbfe88738bef75b285628c7178601cba45f16f411ff648ab864c3a906deb23` |
| `M-ENS-20261025-9` | 2 `AGREE` / 2 `IDLE` | 0 | `COMPLIANT` / `HIGH` | `0x58b78ef3fdfdddaa4fd3dd7af24a120a3aa5a2d80c74b86c9b5f587d46d67a12` |

Result: 8 of 8 assessed, 0 consensus failures, 0 `DISAGREE` votes on 32 validator slots
(19 `AGREE`, 13 `IDLE`), 0 rotations. `M-ENS-20261025-1` also ran and holds a
`COMPLIANT`/`HIGH` assessment, but its hashes were not captured because the harness was
killed mid-run, so it is excluded from the table. Interpretation and the caveats are in
[docs/equivalence.md](../docs/equivalence.md); the raw record is
[docs/evidence/consensus-disagreement.json](../docs/evidence/consensus-disagreement.json).

Three harness probes (`M-PROBE-q1`, `M-PROBE-q2-1`, `M-PROBE-q3-1`) were also created while
debugging the CLI argument handling and then withdrawn (`WITHDRAWN`, read back from chain).
They remain in the dispute list as terminal records.

### Why this deployment replaced the earlier ones

`list_proposals` paged `self.proposals`, a `TreeMap` keyed by proposal id, with an
integer slice. Every call raised `TypeError: '<' not supported between instances of
'slice' and 'str'`, which reached the RPC as `KeyError` / `execution failed`. The
frontend's Proposals screen therefore showed "Could not load proposals" on all three
earlier StudioNet addresses, including the ones listed below. `list_rules` and
`list_disputes` page their `DynArray` id lists and were unaffected.

The view now pages `self.proposal_ids`, and `tests/direct/test_proposals_registry.py`
covers the empty registry, registration order, paging, page-size bounds, and event
counts. The earlier addresses are kept below as history only; they still run the
broken view because a deployed contract cannot be patched.

All data below was produced on 2026-10-20 against GenLayer StudioNet
(chain id `61999`, RPC `https://studio.genlayer.com/api`). Nothing here is
invented: every hash and address comes from real command output, and every
explorer link points at a transaction that was confirmed on chain.

## Official deployment (current source)

**Status: current.** The stored contract code at this address is byte-identical
to `contracts/dao_resolve.py` in this repository. This was checked, not assumed:
the code was downloaded through the JSON-RPC method `gen_getContractCode`,
base64-decoded, and hashed against the working file.

| Item | Value |
|---|---|
| Contract file | `contracts/dao_resolve.py` (1,463 lines) |
| Source SHA-256 | `ed6dff655962b4219dfc1e87c3930900a10aaf68a541be5e5f9e7c429de5f855` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (v0.3.0-rc7) |
| Contract address | `0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2` |
| Deploy transaction | not recorded (official deployment supplied by the user) |
| Deploy transaction status | `FINALIZED`, execution mode `NORMAL`, 5 validators, 0 rotations |
| Deploy timestamp | not recorded |
| Deployer / current owner | `0x5B3661C576c7001e6d6279C67F3779705d334c89` |
| Schema dump | `deployments/studionet.schema.txt` (242 lines: 12 read, 16 write methods) |
| Studio import link | https://studio.genlayer.com/?import-contract=0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2 |
| Explorer — contract | https://explorer-studio.genlayer.com/address/0x8A4bEfBcd15A27155AA2D4b132F6AB86123B56F2 |
| Explorer — deploy tx | https://explorer-studio.genlayer.com/tx/0xb138073ad159cd0e78070490d3d3d9e74ecab2e0ebcf62b5e92680661f29743d |
| Stored code hash | identical to the row above (`ed6dff65…`) |

## Repo deployment on StudioNet (`0x604094ec1E9e181c8C123908D154AB1D0CD8051F`)

Deployed from the current `contracts/dao_resolve.py` in this repo with
`genlayer deploy --contract contracts/dao_resolve.py` on StudioNet after the
`list_proposals` view was added and the duplicate `get_proposal` body was removed.

- **Contract address:** `0x604094ec1E9e181c8C123908D154AB1D0CD8051F`
- **Deploy transaction:** `0x5635ecfca0e5b2fe823e3bb334957516199b2eac3c94564c15e07aa41217be40`
- **Schema saved at:** `frontend/src/config/schema/dao_resolve.json`
- **Explorer:** `https://explorer-studio.genlayer.com/address/0x604094ec1E9e181c8C123908D154AB1D0CD8051F`
- **Studio import:** `https://studio.genlayer.com/?import-contract=0x604094ec1E9e181c8C123908D154AB1D0CD8051F`

### Verified on chain

- `genvm-lint check contracts/dao_resolve.py --json` clean
- `genlayer schema` returned `list_proposals` and `get_proposal` among the public views

### Not yet done

- `genlayer receipt` walkthrough for the deploy tx
- contract runner/run-hash recorded in the deployment record
- `genlayer code` hash recorded

## Official DAO-Resolve.py StudioNet manual deployment

**Status: current deployment under manual review.** This is the address supplied for the
current StudioNet deployment.

| Item | Value |
|---|---|
| Contract address | `0xc9C3be0b1A5cA36d4c4f54b5d48dEB9834e04Ce3` |
| Studio import link | https://studio.genlayer.com/?import-contract=0xc9C3be0b1A5cA36d4c4f54b5d48dEB9834e04Ce3 |
| Explorer — contract | https://explorer-studio.genlayer.com/address/0xc9C3be0b1A5cA36d4c4f54b5d48dEB9834e04Ce3 |
