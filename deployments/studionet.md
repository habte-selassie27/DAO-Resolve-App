# StudioNet Deployment Record

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
