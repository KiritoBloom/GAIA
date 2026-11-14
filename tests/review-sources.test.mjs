import test from 'node:test';import assert from 'node:assert/strict';
import {loadReference} from '../app/backend/knowledge.mjs';
import {validateReviewSources} from '../app/backend/review-sources.mjs';
test('retained current source receipts remain valid for a same-thread peer continuation',()=>{
 const source=loadReference('aura','power-monthly'),items=[{source_id:source.id,quote:source.text.slice(0,80)}],receipt={role:'aura',threadID:'owned-thread',tool:'reference',output:{id:source.id,sha256:source.sha256}};
 const proof=validateReviewSources({literature:[]},'aura',items,[receipt],'owned-thread');assert.equal(proof[0].source_sha256,source.sha256);
 assert.throws(()=>validateReviewSources({literature:[]},'aura',items,[{...receipt,role:'chloris'}],'owned-thread'));
 assert.throws(()=>validateReviewSources({literature:[]},'aura',items,[receipt],'another-thread'));
 assert.throws(()=>validateReviewSources({literature:[]},'aura',items,[{...receipt,output:{...receipt.output,sha256:'stale'}}],'owned-thread'));
});
