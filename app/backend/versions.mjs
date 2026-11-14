import {sha256} from './security.mjs';
// Preserve history: a repeated frozen request selects its most recent execution
// for current-version reproduction without rewriting earlier results.
export function executionVersions(records=[]){
  const selected=new Map();
  for(const record of records)selected.set(record.request?sha256(record.request):record.id,record);
  const active=[...selected.values()],ids=new Set(active.map(record=>record.id));
  return {active,historical:records.filter(record=>!ids.has(record.id))};
}
