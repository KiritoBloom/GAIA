// Lossless coalescing: tokens cross WASM as small patches, never as evidence snapshots.
export function updateBuffer() {
  const pending=new Map();
  return {
    add(sessionID,patch) {
      const key=`${sessionID}:${patch.id}`,previous=pending.get(key);
      if(previous&&patch.sequence<=previous.sequence)return;
      if(!previous){pending.set(key,{...patch,sessionID,tools:patch.tool?[patch.tool]:[]});return;}
      if(patch.turn)previous.turn=patch.turn;
      if(patch.text!==undefined){previous.text=patch.text;delete previous.append;}
      if(patch.append!==undefined){if(previous.text!==undefined)previous.text+=patch.append;else previous.append=(previous.append||'')+patch.append;}
      for(const key of ['thinking','status','connection'])if(patch[key]!==undefined)previous[key]=patch[key];
      if(patch.tool){const found=previous.tools.find(tool=>tool.id===patch.tool.id);if(found)Object.assign(found,patch.tool);else previous.tools.push(patch.tool);}
      previous.sequence=patch.sequence;
    },
    drain(){const updates=[...pending.values()];pending.clear();return updates;},
    clear(){pending.clear();}
  };
}
