// Tab-local UI state only. Provider credentials and private intake forms never enter this record.
export function readUiState(storage){
 try{const value=JSON.parse(storage.getItem('gaia-ui-v1')||'{}');return {selected:typeof value.selected==='string'?value.selected:null,drafts:Object.fromEntries(Object.entries(value.drafts||{}).filter(([,text])=>typeof text==='string')),artifacts:Object.fromEntries(Object.entries(value.artifacts||{}).filter(([,artifact])=>typeof artifact==='string'))};}catch{return{selected:null,drafts:{},artifacts:{}};}
}
export function writeUiState(storage,ui){
 try{storage.setItem('gaia-ui-v1',JSON.stringify({selected:ui.selected,drafts:ui.drafts,artifacts:ui.artifacts}));}catch{/* Storage denial must not prevent local investigation. */}
}
