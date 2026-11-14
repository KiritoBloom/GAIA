import {validateSourceEvidence} from './knowledge.mjs';
import {validatePaperEvidence} from './research.mjs';

export function validateReviewSources(session,role,items,receipts,threadID){
 const paperIDs=new Set((session.literature||[]).map(item=>item.id));
 const producer=items.filter(item=>!paperIDs.has(item.source_id)),papers=items.filter(item=>paperIDs.has(item.source_id));
 const sources=[...(producer.length?validateSourceEvidence(role,producer):[]),...validatePaperEvidence(session,papers)];
 for(const source of sources){const hash=source.source_sha256||source.sha256;
  if(!receipts.some(item=>item.role===role&&item.threadID===threadID&&['reference','read_paper'].includes(item.tool)&&item.output.id===source.source_id&&item.output.sha256===hash))throw Error('Worker needs to retrieve the exact current cited source in its owned conversation.');
 }
 return sources;
}
