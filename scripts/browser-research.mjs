async (page) => {
  const button=name=>page.getByRole('button',{name,exact:true});
  async function location(locator){return locator.evaluate(el=>({x:parseFloat(el.style.left)+parseFloat(el.style.width)/2,y:parseFloat(el.style.top),h:parseFloat(el.style.height)}));}
  async function reveal(locator){
    let r=await location(locator);const height=await page.evaluate(()=>innerHeight);
    if(r.y<90||r.y>height-100){await page.mouse.move(700,350);await page.mouse.wheel(0,r.y-300);}
    await page.waitForFunction(({text})=>{const el=[...document.querySelectorAll('[data-rune-a11y] *')].find(e=>e.textContent===text&&e.style.position==='absolute');if(!el)return false;const y=parseFloat(el.style.top),p=window.__gaiaBrowserLayoutProbe;window.__gaiaBrowserLayoutProbe={text,y,n:p?.text===text&&Math.abs(p.y-y)<.1?p.n+1:0};return y>80&&y<innerHeight-80&&window.__gaiaBrowserLayoutProbe.n>8;},{text:await locator.textContent()},{timeout:20000});return location(locator);
  }
  async function click(name){const r=await reveal(button(name));await page.mouse.click(r.x,r.y+r.h/2);}
  async function fill(label,text){const locator=page.getByText(label,{exact:true}),r=await reveal(locator),left=await locator.evaluate(el=>parseFloat(el.style.left));await page.mouse.click(left+40,r.y+r.h+17);await page.keyboard.press('Control+A');await page.keyboard.insertText(text);await page.waitForFunction(expected=>{const value=document.activeElement?.value;return typeof value==='string'&&(value===expected||expected.endsWith(value)&&value.length===512);},text,{timeout:5000});}
  await page.waitForFunction(()=>{const s=JSON.parse(globalThis.gaiaSnapshot);return s.status.sessions?.length>0;});
  const proof=await page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot);return{tested:s.status.tested,error:s.error};});if(!proof.tested)throw Error(proof.error||'Role proof did not pass.');
  const title=await page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.artifacts.some(a=>a.acquisition.variable.id==='EVI'));return session.title.slice(0,23);});
  await click(title);await click('Research');
  await fill('Research question or literature query','Can similar canopy greenness conceal different moisture stresses? Find contrasting evidence and a discriminating measurement.');
  await click('Search literature');
  await page.waitForFunction(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.id===s.selected);return !s.operation&&(s.error||session.literature?.length);},{},{timeout:60000});
  const research=await page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.id===s.selected);return{error:s.error,sources:session.literature?.length,firstTitle:session.literature?.[0]?.title};});if(research.error)throw Error(research.error);
   await click('Discuss this question with GAIA');
  await fill('Question, region, period and available observations','Investigate the actual MODIS prairie record without assuming plant damage or animal deaths. Search and read relevant literature and contrary evidence. Ask the relevant functions to inspect their own procedures and source support. AURA may acquire weather context and run a justified diagnostic. Explore a non-obvious alternative, request a useful peer check, retain a provisional research note, and run an eligible scenario or explicitly propose a new model if the available inputs cannot justify one. Distinguish your ideas from measurements and recommend the observation that best separates the competing expectations. Keep Jev shadow-only.');
  await click('Submit question');
   return page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.id===s.selected);return{real_browser_submission:true,provider_tested:s.status.tested,operation:s.operation,error:s.error,sources:session.literature.length,question:session.messages.at(-1)?.role,actual_question_length:session.messages.at(-1)?.text?.length};});
}
