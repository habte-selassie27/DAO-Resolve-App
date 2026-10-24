<template>
  <div class="stack">
    <div class="between">
      <div>
        <h1>Rules</h1>
        <p class="muted" style="margin: 0">
          A dispute pins the rule version that existed when it opened. New versions supersede old
          ones; old versions stay readable for the record.
        </p>
      </div>
    </div>

    <div class="panel flat toolbar">
      <label class="sr-only" for="rule-search">Search rules</label>
      <input id="rule-search" v-model="query" type="search" placeholder="Search rule id or title" />
      <span class="chip">{{ filteredRules.length }} active</span>
      <span class="spacer" />
      <RouterLink class="small" to="/proposals">Proposals →</RouterLink>
    </div>

    <ErrorNotice
      v-if="error"
      :error="error"
      title="Could not load rules"
      retry-label="Try again"
      @retry="load"
    />
    <div v-if="loading" class="stack"><div class="skeleton" style="width: 45%" /><div class="skeleton" style="width: 70%" /></div>
    <div v-else-if="filteredRules.length" class="stack" style="gap: 12px">
      <article v-for="rule in filteredRules" :key="`${rule.rule_id}-${rule.version}`" class="panel">
        <div class="between">
          <div>
            <div class="row" style="margin-bottom: 4px">
              <span class="mono">{{ rule.rule_id }}</span>
              <span class="chip">v{{ rule.version }}</span>
              <span class="chip">{{ rule.category }}</span>
              <span class="chip" :class="rule.interpretation === 'DETERMINISTIC_ONLY' ? 'compliant' : 'signal'">
                {{ rule.interpretation === "DETERMINISTIC_ONLY" ? "code-checkable" : "needs interpretation" }}
              </span>
            </div>
            <h3 style="margin-bottom: 4px">{{ rule.title }}</h3>
            <p class="small muted" style="margin: 0">
              {{
                rule.interpretation === "DETERMINISTIC_ONLY"
                  ? "Code decides this rule. No model call is needed."
                  : "Code checks run first; validator consensus reads the residual ambiguity."
              }}
            </p>
          </div>
          <RouterLink class="button secondary small" :to="`/rules/${rule.rule_id}`">Open rule</RouterLink>
        </div>
      </article>
    </div>
    <EmptyState v-else :message="query ? 'No active rule matches that search.' : emptyCopy.rules" />

    <section class="panel" aria-labelledby="register-rule-title">
      <h2 id="register-rule-title" style="margin-top: 0">Register a rule</h2>
      <p v-if="!state.address" class="notice system small" style="margin-bottom: 12px">
        Connect a wallet to sign this transaction. Reads work without one.
      </p>
      <form novalidate @submit.prevent="submit">
        <div class="form-grid">
          <div class="field">
            <label for="rule-id">Rule id</label>
            <input id="rule-id" v-model.trim="form.ruleId" required maxlength="64" placeholder="R-REVIEW" />
            <span class="hint">Letters, digits, dash, underscore, dot, colon. Max 64 characters.</span>
          </div>
          <div class="field">
            <label for="rule-title">Title</label>
            <input id="rule-title" v-model.trim="form.title" required maxlength="120" placeholder="Minimum review period" />
          </div>
          <div class="field">
            <label for="rule-category">Category</label>
            <select id="rule-category" v-model="form.category">
              <option>PROCESS</option><option>QUORUM</option><option>TIMING</option>
              <option>ELIGIBILITY</option><option>DISCLOSURE</option><option>OTHER</option>
            </select>
          </div>
          <div class="field">
            <label for="rule-interpretation">Interpretation</label>
            <select id="rule-interpretation" v-model="form.interpretation">
              <option value="DETERMINISTIC_ONLY">DETERMINISTIC_ONLY</option>
              <option value="NEEDS_INTERPRETATION">NEEDS_INTERPRETATION</option>
            </select>
            <span class="hint">DETERMINISTIC_ONLY requires at least one check.</span>
          </div>
          <div class="field full">
            <label for="rule-clause">Clause text</label>
            <textarea id="rule-clause" v-model.trim="form.clauseText" required maxlength="2000" placeholder="Proposals require at least 48 hours of review before voting…" />
            <span class="hint">{{ form.clauseText.length }} / 2000 characters. Required.</span>
          </div>
        </div>

        <hr class="divider" />
        <h3>Structured checks</h3>
        <p class="small muted">
          These run in code before any model. A failed check forces a violation. For an
          interpretive rule, a failed check is still decisive.
        </p>
        <CheckEditor v-model="form.checks" />
        <hr class="divider" />
        <p v-if="formError" class="notice violation small">{{ formError }}</p>
        <div class="row">
          <button class="button" type="submit" :disabled="submitting || !state.address">
            {{ submitting ? "Submitting…" : "Register rule" }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import CheckEditor from "../components/CheckEditor.vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorNotice from "../components/ErrorNotice.vue";
import { emptyCopy } from "../domain/copy.js";
import { state } from "../lib/store.js";
import { listRules } from "../lib/chain/reads.js";
import { registerRule } from "../lib/chain/writes.js";
import { runTransaction } from "../lib/chain/tx.js";
import { bindFormDraft } from "../lib/formPersistence.js";
import { toContractChecks, validateRuleForm } from "../lib/ruleValidation.js";

const RULE_FORM_DEFAULTS = {
  ruleId: "",
  title: "",
  category: "TIMING",
  interpretation: "DETERMINISTIC_ONLY",
  clauseText: "",
  checks: [],
};

const rules = ref([]);
const loading = ref(true);
const error = ref("");
const query = ref("");
const submitting = ref(false);
const formError = ref("");

const form = reactive({ ...RULE_FORM_DEFAULTS, checks: [] });
// Draft persists across reloads and hard refreshes so a rejected wallet
// signature never loses the entered rule.
const formDraft = bindFormDraft("rule:register", form, RULE_FORM_DEFAULTS);
// Older drafts stored lowercase role values; the contract only accepts the
// enum names RULE_REGISTRAR / RECORDER / ESCALATOR.
const LEGACY_CHECK_ROLES = {
  registrar: "RULE_REGISTRAR",
  recorder: "RECORDER",
  escalator: "ESCALATOR",
  owner: "",
};
form.checks = (Array.isArray(form.checks) ? form.checks : []).map((check) => {
  const role = String(check.role || "");
  const mapped = LEGACY_CHECK_ROLES[role.toLowerCase()];
  return { ...check, role: mapped === undefined ? role.toUpperCase() : mapped };
});

const filteredRules = computed(() => {
  const term = query.value.trim().toLowerCase();
  if (!term) return rules.value;
  return rules.value.filter(
    (rule) => rule.rule_id.toLowerCase().includes(term) || rule.title.toLowerCase().includes(term)
  );
});

async function load() {
  loading.value = true;
  try {
    rules.value = (await listRules(0, 50)) || [];
    error.value = "";
  } catch (loadError) {
    error.value = loadError?.message || String(loadError);
  } finally {
    loading.value = false;
  }
}

function validate() {
  return validateRuleForm(form);
}

async function submit() {
  formError.value = validate();
  if (formError.value) return;
  submitting.value = true;
  try {
    const result = await runTransaction({
      label: `Register rule ${form.ruleId}`,
      send: () =>
        registerRule({
          ruleId: form.ruleId,
          title: form.title,
          clauseText: form.clauseText,
          category: form.category,
          interpretation: form.interpretation,
          checks: toContractChecks(form.checks),
        }),
      onFinalized: load,
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
