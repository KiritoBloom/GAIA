async(page)=>{
 const position=locator=>locator.evaluate(el=>({x:parseFloat(el.style.left)+parseFloat(el.style.width)/2,y:parseFloat(el.style.top),h:parseFloat(el.style.height)}));
 async function click(name){const locator=page.getByRole('button',{name,exact:true}),r=await position(locator);if(r.y<80||r.y>await page.evaluate(()=>innerHeight)-80){await page.mouse.move(700,350);await page.mouse.wheel(0,r.y-300);}await page.waitForFunction(({name})=>{const el=[...document.querySelectorAll('[data-rune-a11y] button')].find(x=>x.textContent===name);if(!el)return false;const y=parseFloat(el.style.top),p=window.__gaiaBrowserLayoutProbe;window.__gaiaBrowserLayoutProbe={name,y,n:p?.name===name&&Math.abs(p.y-y)<.1?p.n+1:0};return y>80&&y<innerHeight-80&&window.__gaiaBrowserLayoutProbe.n>8;},{name},{timeout:15000});const q=await position(locator);await page.mouse.click(q.x,q.y+q.h/2);}
 const name=await page.evaluate(()=>JSON.parse(globalThis.gaiaSnapshot).status.sessions.find(s=>s.artifacts.some(a=>a.acquisition.variable.id==='EVI')).title.slice(0,23));
 await click(name);await click('Investigation record');await click('Refresh evidence graph and records');
 await page.waitForFunction(()=>{const s=JSON.parse(globalThis.gaiaSnapshot);return !s.operation&&(s.investigation||s.error);},null,{timeout:30000});
 const result=await page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),r=s.investigation;return{error:s.error,canvas:document.querySelectorAll('canvas').length,nodes:r?.mechanism_graph.nodes.length,uncertifiedEdges:r?.mechanism_graph.edges.filter(e=>e.causal_certification===false).length,tests:r?.signature_test_records.length,recordHash:r?.record_hash};});
 if(result.error||!result.nodes||!result.tests)throw Error('Actual investigation record view failed.');
 await click('Scenario portfolio');await click('Test records');await click('Evidence graph');
 return result;
}
