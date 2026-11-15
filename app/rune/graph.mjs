export function mechanismGraph(graph){
 if(!graph?.nodes?.length)return '';
 const locations=new Map(),nodes=graph.nodes,counts={quantity:0,proposed_mechanism:0,requested_outcome:0};
 for(const node of nodes){const column={quantity:25,proposed_mechanism:330,requested_outcome:635}[node.kind];locations.set(node.id,{x:column,y:35+counts[node.kind]++*65});}
 const height=Math.max(150,...Object.values(counts).map(n=>45+n*65));
 const escape=value=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&apos;','"':'&quot;'}[c]));
  const edges=graph.edges.map(edge=>{const a=locations.get(edge.from),b=locations.get(edge.to);if(!a||!b)return '';return `<path d="M${a.x+250} ${a.y+20} C${a.x+280} ${a.y+20},${b.x-30} ${b.y+20},${b.x} ${b.y+20}" stroke="#7c858f" stroke-dasharray="5 5" fill="none"/>`;}).join('');
  const shapes=nodes.map(node=>{const p=locations.get(node.id),color={quantity:'#dce1e6',proposed_mechanism:'#9eabb9',requested_outcome:'#6e7883'}[node.kind];return `<rect x="${p.x}" y="${p.y}" width="250" height="40" rx="4" fill="#191c20" stroke="${color}"/><text x="${p.x+10}" y="${p.y+25}" font-family="sans-serif" font-size="12" fill="#f0f0f2">${escape(node.label.slice(0,32))}</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="910" height="${height}" viewBox="0 0 910 ${height}"><rect width="910" height="${height}" fill="#121315"/>${edges}${shapes}</svg>`;
}
