async (page) => {
  const button = name => page.getByRole('button',{name,exact:true});
  const coordinates = async locator => locator.evaluate(el => ({x:parseFloat(el.style.left)+parseFloat(el.style.width)/2,y:parseFloat(el.style.top),h:parseFloat(el.style.height)}));
  async function reveal(locator){
    let r=await coordinates(locator),height=await page.evaluate(()=>innerHeight);
    if(r.y<90||r.y>height-100){await page.mouse.move(700,350);await page.mouse.wheel(0,r.y-300);}
    await page.waitForFunction(({text})=>{
      const el=[...document.querySelectorAll('[data-rune-a11y] *')].find(e=>e.textContent===text&&e.style.position==='absolute');
      if(!el)return false;const y=parseFloat(el.style.top);const key='__gaiaBrowserLayoutProbe';const previous=window[key];window[key]={text,y,n:previous?.text===text&&Math.abs(previous.y-y)<.1?previous.n+1:0};return y>80&&y<innerHeight-80&&window[key].n>8;
    },{text:await locator.textContent()},{timeout:15000});
    return coordinates(locator);
  }
  async function click(name){const locator=button(name),r=await reveal(locator);await page.mouse.click(r.x,r.y+r.h/2);}
  async function fill(label,text){const locator=page.getByText(label,{exact:true}),r=await reveal(locator);await page.mouse.click(r.x,r.y+r.h+17);await page.keyboard.press('Control+A');await page.keyboard.insertText(text);const actual=await page.evaluate(()=>document.activeElement?.value);if(actual!==text)throw new Error('Rune text input did not accept the actual keyboard value.');}
  await click('New investigation');
  await page.waitForFunction(()=>{const s=JSON.parse(globalThis.gaiaSnapshot);return s.selected&&!s.operation;});
  await click('Evidence');
  await fill('Variable: T2M, PRECTOTCORR, RH2M or EVI','EVI');
  await fill('MODIS fixed-site identifier (EVI only)','ca_alberta_alberta__mixed_grass_prairie');
  await click('Acquire data and calculate trend');
  await page.waitForFunction(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.id===s.selected);return !s.operation&&(s.error||session?.artifacts.some(x=>x.acquisition.variable.id==='EVI'));},{},{timeout:180000});
  return page.evaluate(()=>{const s=JSON.parse(globalThis.gaiaSnapshot),session=s.status.sessions.find(x=>x.id===s.selected),a=session.artifacts.find(x=>x.acquisition.variable.id==='EVI');return {error:s.error,sessionID:session.id,variable:a?.acquisition.variable.id,site:a?.acquisition.geometry.siteid,collection:a?.acquisition.provenance.collection_versions,n:a?.analysis.n,missing:a?.analysis.missing,status:a?.analysis.status,excluded:a?.acquisition.provenance.collection_identity_evidence.excluded_granules.length};});
}
