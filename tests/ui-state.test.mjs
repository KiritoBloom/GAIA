import test from 'node:test';
import assert from 'node:assert/strict';
import {readUiState,writeUiState} from '../app/rune/ui-state.mjs';
test('tab recovery retains separate drafts and selections, never arbitrary credential fields',()=>{
 let raw;const storage={getItem:()=>raw,setItem:(_key,value)=>raw=value};
 writeUiState(storage,{selected:'one',drafts:{one:'first question',two:'different question'},artifacts:{one:'owned-id'},apiKey:'DO_NOT_STORE',privateIntake:'DO_NOT_STORE'});
 assert.doesNotMatch(raw,/DO_NOT_STORE|apiKey|privateIntake/);assert.deepEqual(readUiState(storage),{selected:'one',drafts:{one:'first question',two:'different question'},artifacts:{one:'owned-id'}});
 raw='{broken';assert.deepEqual(readUiState(storage),{selected:null,drafts:{},artifacts:{}});
});
test('unavailable browser storage is nonfatal',()=>{const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.equal(readUiState(denied).selected,null);assert.doesNotThrow(()=>writeUiState(denied,{}));});
