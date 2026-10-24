<template>
  <div class="stack">
    <div class="between">
      <div>
        <h1>Proposals</h1>
        <p class="muted" style="margin: 0">
          Proposals are the anchor for process events. Anyone can register one; the contract
          records the signer. A dispute points at one proposal and one pinned rule version.
          The list below is read directly from the chain.
        </p>
      </div>
    </div>



    <ErrorNotice
      v-if="error"
      :error="error"
      title="Could not load proposals"
      retry-label="Try again"
      @retry="load"
    />
    <div v-if="loading" class="stack"><div class="skeleton" style="width: 50%" /><div class="skeleton" style="width: 75%" /></div>
    <div v-else-if="proposals.length" class="grid two">
      <article v-for="proposal in proposals" :key="proposal.proposal_id" class="panel">
        <div class="between" style="margin-bottom: 6px">
          <span class="mono">{{ proposal.proposal_id }}</span>
          <span class="chip">{{ proposal.event_count }} events</span>
        </div>
        <p class="serif" style="margin-bottom: 6px">{{ proposal.status_note || "No status note." }}</p>
        <p class="small muted wrap" style="margin-bottom: 10px">
          <a v-if="safeUrl(proposal.content_ref)" :href="proposal.content_ref" target="_blank" rel="noopener noreferrer">{{ proposal.content_ref }}</a>
          <span v-else>{{ proposal.content_ref || "No content recorded." }}</span>
        </p>
        <div class="between">
          <span class="tiny muted">registered {{ formatTime(proposal.created_at) }}</span>
          <span class="tiny muted">by {{ safeAddress(proposal.created_by) }}</span>
          <RouterLink class="button secondary small" :to="`/proposals/${proposal.proposal_id}`">Open process</RouterLink>
        </div>
      </article>
    </div>
    <EmptyState v-else :message="emptyCopy.proposals" />

    <section class="panel" aria-labelledby="register-proposal-title">
      <h2 id="register-proposal-title" style="margin-top: 0">Register a proposal</h2>
      <p v-if="!state.address" class="notice system small" style="margin-bottom: 12px">
        Connect a wallet to sign this transaction. Reads work without one.
      </p>
      <form novalidate @submit.prevent="submit">
        <div class="field">
          <label for="proposal-id">Proposal id</label>
          <input id="proposal-id" v-model.trim="form.proposalId" required maxlength="64" placeholder="P-001" />
          <span class="hint">Letters, digits, dash, underscore, dot, colon. Max 64 characters.</span>
        </div>
        <div class="field">
          <label for="proposal-ref">Proposal content or source link</label>
          <textarea id="proposal-ref" v-model.trim="form.contentRef" required maxlength="512" rows="3" placeholder="Treasury diversification: move 500,000 GEN into a stable reserve over three months, with monthly reporting." />
          <span class="hint">
            Type the proposal text, or paste a link to its public page. It is stored on chain as
            written. {{ form.contentRef.length }} / 512 characters.
          </span>
        </div>
        <div class="field">
          <label for="proposal-note">Status note</label>
          <input id="proposal-note" v-model.trim="form.statusNote" maxlength="280" placeholder="Discussion opened; vote not started." />
          <span class="hint">{{ form.statusNote.length }} / 280 characters.</span>
        </div>
        <p v-if="formError" class="notice violation small">{{ formError }}</p>
        <div class="row">
          <button class="button" type="submit" :disabled="submitting || !state.address">{{ submitting ? "Submitting…" : "Register proposal" }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorNotice from "../components/ErrorNotice.vue";
import { state } from "../lib/store.js";
import { emptyCopy } from "../domain/copy.js";
import { formatTime, safeAddress } from "../lib/format.js";
import { listProposals } from "../lib/chain/reads.js";
import { registerProposal } from "../lib/chain/writes.js";
import { runTransaction } from "../lib/chain/tx.js";
import { bindFormDraft } from "../lib/formPersistence.js";
import { rememberProposal } from "../lib/proposalRegistry.js";

const PROPOSAL_FORM_DEFAULTS = { proposalId: "", contentRef: "", statusNote: "" };

const proposals = ref([]);
const loading = ref(true);
const error = ref("");
const submitting = ref(false);
const formError = ref("");
const form = reactive({ ...PROPOSAL_FORM_DEFAULTS });
// Draft persists across reloads and hard refreshes so a rejected wallet
// signature never loses the entered proposal.
const formDraft = bindFormDraft("proposal:register", form, PROPOSAL_FORM_DEFAULTS);

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function load() {
  loading.value = true;
  try {
    proposals.value = (await listProposals(0, 50)) || [];
    error.value = "";
  } catch (loadError) {
    error.value = loadError?.message || String(loadError);
  } finally {
    loading.value = false;
  }
}

function validate() {
  if (!form.proposalId) return "Add a proposal id, for example P-001.";
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(form.proposalId)) {
    return "Proposal id may only use letters, digits, and - _ . : (1-64 characters, no spaces).";
  }
  if (!form.contentRef.trim()) return "Add the proposal content or a link to its public page.";
  if (form.contentRef.length > 512) return "Proposal content is over the 512 character limit.";
  if (form.statusNote.length > 280) return "Status note is over the 280 character limit.";
  return "";
}

async function submit() {
  formError.value = validate();
  if (formError.value) return;
  const proposalId = form.proposalId;
  submitting.value = true;
  try {
    const result = await runTransaction({
      label: `Register proposal ${proposalId}`,
      send: () =>
        registerProposal({
          proposalId,
          contentRef: form.contentRef,
          statusNote: form.statusNote,
        }),
      // The new proposal is now on chain and returned by list_proposals, so this
      // browser refresh does not need to remember it for the next load.
      onFinalized: () => {
        rememberProposal(proposalId);
        load();
      },
    });
    if (!result.ok) {
      formError.value = "The transaction did not finalize. Review the transaction tray and try again.";
      return;
    }
    formDraft.reset();
  } catch (txError) {
    formError.value = txError?.message || "The transaction could not be submitted.";
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>
