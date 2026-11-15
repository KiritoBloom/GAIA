import { sha256 } from './security.mjs';

// Retrieval timestamps, task IDs and artifact UUIDs do not make repeated data
// new evidence. Derived support/method changes are visible, never independence.
export function evidenceState(session) {
  return [...new Set((session.artifacts||[]).map(a=>sha256({
    quantity:a.acquisition?.variable?.id,provider:a.acquisition?.variable?.provider,inputs:a.analysis?.inputs_sha256,
    method:a.analysis?.specification_hash,period:[a.analysis?.requested_start,a.analysis?.requested_end],
    boundary:a.acquisition?.geometry?.boundary_sha256,
    point:[a.acquisition?.geometry?.latitude,a.acquisition?.geometry?.longitude],
    support:a.acquisition?.geometry?.type,
    sources:a.analysis?.inputs_sha256?null:(a.acquisition?.provenance?.files?.map(f=>f.raw_sha256||f.sha256).sort()||a.acquisition?.provenance?.raw_sha256||null)
  })))].sort();
}

export function unresolvedEvidence(session, reviews=[]) {
  const artifacts=(session.artifacts||[]).filter(a=>['inconclusive','descriptive_only'].includes(a.analysis?.status)&&!a.acquisition?.analysis_recipe);
  return {
    no_numerical_evidence:!(session.artifacts||[]).length,
    artifacts:artifacts.map(a=>({id:a.id,quantity:a.acquisition?.variable,period:[a.analysis?.requested_start,a.analysis?.requested_end],support:a.acquisition?.geometry?.type,status:a.analysis?.status,n:a.analysis?.n,missing:a.analysis?.missing,limitations:a.analysis?.limitations})),
    failed_acquisitions:(session.extractions||[]).filter(t=>['failed','paused'].includes(t.status)).map(t=>({id:t.id,status:t.status,reason:t.failure})),
    failed_reviews:reviews.filter(r=>r.status==='failed').map(r=>({role:r.role,reason:r.reason}))
  };
}

export function needsRecovery(gaps) {
  return gaps.no_numerical_evidence||gaps.artifacts.length>0||gaps.failed_acquisitions.length>0||gaps.failed_reviews.length>0;
}

export const recoveryPolicy = `Investigate inadequate evidence, not unwanted conclusions. A valid not_detected result is not a failed acquisition and must not trigger a hunt for significance. Inspect why evidence is inconclusive: coverage, QA, short record, wrong quantity/support, missing direct outcome or provider failure. Seek a scientifically defensible alternative available through actual tools: a more appropriate product/index/independent measurement, justified temporal/spatial support, or researched source and documented import gap. Read provider/method documentation using owned research tools. Preserve the original question, primary findings and every attempted source. Never change a period, index, season, threshold or model merely to get significance; no silent lower QA thresholds, imputation, biome substitution or point-as-region claims. Same-product indices and derivatives are not independent corroboration; conditional sensitivities do not repair measurement gaps. Do not invent adapters, measurements or manual actions as completed. Resume an existing owned NASA task rather than submitting duplicates. The user does not configure this work. If no defensible available alternative exists, finish honestly with what remains inconclusive and the concrete missing observation. Do not keep repeating equivalent data or failed strategies.`;
