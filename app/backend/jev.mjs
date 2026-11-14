import { performance } from 'node:perf_hooks';
import { sha256 } from './security.mjs';
import { readFileSync } from 'node:fs';

let model;
const key = () => process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_KEY;
export const semanticStatus = () => {let evaluation='not_evaluated';try{evaluation=JSON.parse(readFileSync('.runtime/proofs/jev-evaluation.json','utf8')).evaluation;}catch{}return { configured: !!key(), model, influence: 'shadow_only', evaluation };};

export async function semanticJudgment(state, questions, signal) {
  const started = performance.now();
  const specification = { state, questions, requested_model: model || 'discover' };
  if (!key()) return { status: 'unavailable', influence: 'shadow_only', reason: 'No TypeSafe credential configured.' };
  if (JSON.stringify(specification).length > 36_000 || Object.keys(questions).length > 24) throw new Error('Semantic judgment budget exceeded.');
  const headers = { authorization: `Bearer ${key()}`, 'content-type': 'application/json' };
  const timeout = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(30_000)]);
  try {
    if (!model) {
      const listed = await fetch('https://api.typesafe.ai/v1/models', { headers, signal: timeout });
      if (!listed.ok) throw new Error('Model discovery unavailable.');
      const names = (await listed.json()).models;
      if (!Array.isArray(names)) throw new Error('Invalid TypeSafe model catalog.');
      const versions = names.filter(item => /^jev-\d+\.\d+\.\d+$/.test(item.name)).sort((a,b) => b.name.localeCompare(a.name, 'en', { numeric: true }));
      model = versions[0]?.name || names.find(item => item.name === 'jev-latest')?.name;
      if (!model) throw new Error('No supported Jev model available.');
    }
    const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers, signal: timeout, body: JSON.stringify({ model, state, questions }) });
    if (!response.ok) throw new Error('Semantic service did not return a successful judgment.');
    const result = await response.json();
    for (const [id, question] of Object.entries(questions)) {
      const answer = result.answers?.[id];
      if (!answer || answer.type !== question.type) throw new Error('Semantic answer schema mismatch.');
      if (answer.type === 'noul' && !(answer.noul >= 0 && answer.noul <= 1)) throw new Error('Invalid Noul probability.');
      if (answer.type === 'choice' && !Object.hasOwn(question.criteria, answer.choice)) throw new Error('Invalid Choice answer.');
      if (answer.type === 'score' && !(answer.score >= 0 && answer.score <= question.criteria.length-1)) throw new Error('Invalid Score answer.');
      if (answer.type !== 'noul') {
        if (!Number.isFinite(answer.confidence) || answer.confidence<0 || answer.confidence>1) throw new Error('Invalid judgment confidence.');
        const expected=answer.type==='choice'?Object.keys(question.criteria):question.criteria.map((_,index)=>String(index));
        if (!answer.probabilities || expected.some(id=>!Number.isFinite(answer.probabilities[id]) || answer.probabilities[id]<0 || answer.probabilities[id]>1) || Object.keys(answer.probabilities).some(id=>!expected.includes(id)) || Math.abs(expected.reduce((sum,id)=>sum+answer.probabilities[id],0)-1)>.001) throw new Error('Invalid judgment distribution.');
      }
    }
    model = result.model;
    return { status: 'completed', influence: 'shadow_only', model: result.model, answers: result.answers, usage: result.usage, elapsed_ms: Math.round(performance.now()-started), specification_hash: sha256(specification), limitation: 'Experimental semantic judgments; not numerical significance, causal probability, or independent scientific validation.' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: 'unavailable', influence: 'shadow_only', model, elapsed_ms: Math.round(performance.now()-started), reason: 'TypeSafe request failed or exceeded its budget; deterministic workflow remains active.' };
  }
}

export function reviewQuestions() {
  return {
    intent: { type: 'choice', instructions: 'Which requested output is primary in `request`? This judgment is recorded in shadow mode, not used to route.', criteria: { trend: 'Quantify measured change over time.', mechanism: 'Compare explanations of an observed change.', scenario: 'Explore conditional model behavior.', observation: 'Choose additional evidence.', clarify: 'Insufficient scope or unsupported output.' } },
    observable: { type: 'noul', instructions: 'Does `protocol` specify an actual observable, location/support and timing capable of distinguishing the stated `hypotheses`?', criteria: { true: 'Concrete contrasting expected evidence at a stated support and time.', false: 'Vague, missing support, or the same expected result under both alternatives.' } },
    fit: { type: 'score', instructions: 'How specifically does `protocol` address the contrast between `hypotheses`?', criteria: ['No relevant contrast.', 'Related environmental context only.', 'Useful contrast with major unresolved local differences.', 'Directly relevant observable contrast with stated remaining ambiguity.'] },
    support: { type: 'choice', instructions: 'Does the supplied `source_context` support the exact `claim` without extrapolating scale, diagnosing biology, or proving causation?', criteria: { supports: 'The supplied source context directly supports the carefully scoped claim.', contradicts: 'The source context states an incompatible quantity or interpretation.', unsupported: 'The required claim is not supported by the supplied context.' } }
  };
}
