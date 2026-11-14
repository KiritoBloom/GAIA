import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Plus, SlidersHorizontal, X, GlobeHemisphereWest, ChatCircle, ChartLineUp, ArrowDown, CircleNotch, Check, WarningCircle, Flask, DownloadSimple, CaretDown, Key, Stop, Compass, FolderOpen, Copy } from '@phosphor-icons/react';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import './styles.css';
import './enhancements.css';

type AnyRecord = Record<string, any>;
const roles = [
  { id: 'aura', name: 'AURA', label: 'Atmosphere', description: 'Air, weather and the forces above us.', color: '#ff976a' },
  { id: 'thalassa', name: 'THALASSA', label: 'Water', description: 'Water stores, pathways and what flows between them.', color: '#49e5cf' },
  { id: 'chloris', name: 'CHLORIS', label: 'Plants', description: 'Growth, seasons and the signals in a living landscape.', color: '#cee96f' },
  { id: 'zoe', name: 'ZOE', label: 'Animal life', description: 'Who was observed, where, and who may have been missed.', color: '#cfb7f5' },
];
async function api(path: string, input?: AnyRecord) {
  const response = await fetch(`/api/${path}`, input ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gaia-client': '1' }, body: JSON.stringify(input) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The local service could not complete this request.');
  return result;
}
const number = (value: number | null | undefined, precision = 3) => value == null ? '—' : value.toLocaleString('en', { maximumSignificantDigits: precision });

function SourceLinks({ sources }: { sources: string[] }) {
  return <>{[...new Set(sources.filter(Boolean))].map(source => {
    let url: URL | undefined;
    try { const parsed = new URL(source); if (['https:', 'http:'].includes(parsed.protocol)) url = parsed; } catch { /* A citation can be plain text. */ }
    return url ? <a key={source} className="source-link" href={url.href} target="_blank" rel="noreferrer">{url.hostname}<ArrowUpRight size={14}/></a> : <p className="micro" key={source}>{source}</p>;
  })}</>;
}

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small' : ''}`}>
<img src="/logos/gaia-icon.svg" alt=""/>
<div>
<strong>GAIA<span className="brand-dot">.</span>
</strong>{!small && <span>EARTH-SYSTEM ANALYSIS</span>}</div>
</div>;
}

function Setup({ status, onClose, onRefresh }: { status: AnyRecord; onClose: () => void; onRefresh: () => void }) {
  const [name, setName] = useState('OpenAI-compatible provider'), [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [key, setKey] = useState(''), [models, setModels] = useState<string[]>([]), [model, setModel] = useState('');
  const [local, setLocal] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [proof, setProof] = useState<AnyRecord | null>(null);
  async function discover(useLocal: boolean) {
    setBusy('Discovering available models'); setError('');
    try {
      const data = await api(useLocal ? 'provider/local-models' : 'provider/models', useLocal ? {} : { endpoint, key });
      setModels(data.models); setModel(data.models.find((id: string) => /gpt-6\.1-sol$/.test(id)) || data.models.find((id: string) => /sonnet/.test(id)) || data.models[0] || '');
      if (useLocal) { setName(data.name); setEndpoint(data.endpoint); }
      setLocal(useLocal);
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(''); }
  }
  async function connect() {
    setBusy('Connecting your local runtime'); setError('');
    try { await api('provider/connect', { name, endpoint, key, model, use_local: local }); setKey(''); onRefresh(); setBusy('Checking five roles and tool execution'); const result = await api('provider/proof', {}); setProof(result); onRefresh(); } catch (failure) { setError((failure as Error).message); } finally { setBusy(''); }
  }
  return <div className="modal-backdrop">
<section className="setup modal" aria-label="Provider onboarding">
<button className="icon-button close" onClick={onClose} aria-label="Close provider settings">
<X/>
</button>
<div className="eyebrow">
<Key size={16}/> LOCAL PROVIDER CONFIGURATION</div>
<h2>Configure a model provider</h2>
<p className="muted">Choose a model you trust. Your key goes only to the local backend; it is never included in a conversation or exported.</p>
<div className="setup-notice">
<span className="status-dot"/> Numerical Earth-data analysis works without a model key.</div>
    {status.local_configuration_available && <button className="local-config" onClick={() => discover(true)} disabled={!!busy}>
<FolderOpen size={20}/>
<span>Use this folder’s private configuration<small>Discover models without displaying saved credentials</small>
</span>
<ArrowRight/>
</button>}
    <div className="setup-fields">
<label>Provider name<input value={name} onChange={event => { setName(event.target.value); setLocal(false); }}/>
</label>
<label>Compatible API endpoint<input value={endpoint} onChange={event => { setEndpoint(event.target.value); setLocal(false); }}/>
</label>
<label>API key <span className="muted">or leave empty for a local server</span>
<input type="password" autoComplete="off" value={key} onChange={event => { setKey(event.target.value); setLocal(false); }} placeholder="Stored for this backend session only"/>
</label>
</div>
    <div className="inline-actions">
<button className="secondary" onClick={() => discover(false)} disabled={!!busy}>Discover models <ArrowRight/>
</button>
<span className="micro">Remote inference may incur provider costs.</span>
</div>
    {models.length > 0 && <label className="model-select">Model<select value={model} onChange={event => setModel(event.target.value)}>{models.map(id => <option key={id}>{id}</option>)}</select>
<button className="primary" onClick={connect} disabled={!!busy}>Connect & verify tools <ArrowRight/>
</button>
</label>}
    {busy && <p className="busy-line">
<CircleNotch className="spin"/>{busy}…</p>}{error && <div className="error">
<WarningCircle/>{error}</div>}{proof && <div className="success">
<Check/> Five distinct role/tool round trips passed. This proves integration, not scientific expertise.<button className="text-button" onClick={onClose}>Enter workspace <ArrowRight/>
</button>
</div>}
    {status.configured && <button className="text-button" disabled={!!busy} onClick={async () => { try { await api('provider/remove', {}); setKey(''); setProof(null); onRefresh(); } catch (failure) { setError((failure as Error).message); } }}>Disconnect and clear the session-only provider key</button>}
    <footer className="setup-footer">OpenCode V2 · 2.3.0 <span>Local-first. Not necessarily offline.</span>
</footer>
</section>
</div>;
}

function Constellation({ onChat, onInspect }: { onChat: () => void; onInspect: (id: string) => void }) {
  return <section className="system-view">
<div className="system-heading">
<div className="eyebrow">FUNCTIONS AND INVESTIGATION STATUS</div>
<h1>Investigation workspace</h1>
<p>Select GAIA to define a question, region and period.<br/>Select a specialist to inspect its evidence and activity.</p>
</div>
<div className="constellation">
<svg className="connectors" viewBox="0 0 700 520" aria-hidden="true">
<path d="M350 255V98M350 255H552M350 255V445M350 255H148"/>
<circle cx="350" cy="255" r="170"/>
<circle cx="350" cy="255" r="236"/>
</svg>
<button className="gaia-node" onClick={onChat}>
<img src="/logos/gaia-icon.svg" alt="GAIA planetary G"/>
<strong>GAIA</strong>
<span>Open investigation <ArrowRight size={13}/>
</span>
</button>{roles.map(role => <button key={role.id} className={`function-node ${role.id}`} onClick={() => onInspect(role.id)} style={{ '--role-color': role.color } as React.CSSProperties}>
<img src={`/logos/${role.id}-icon.svg`} alt=""/>
<strong>{role.name}</strong>
<span>{role.label}</span>
</button>)}</div>
<div className="system-bottom">
<span className="micro">
<span className="status-dot"/> Functions activate only when the evidence calls for them.</span>
<button className="text-button" onClick={onChat}>Define investigation <ArrowRight/>
</button>
</div>
</section>;
}

function TrendChart({ artifact }: { artifact: AnyRecord }) {
  const [adjusted, setAdjusted] = useState(false);
  const analysis = artifact.analysis, rows = adjusted ? analysis.anomalies : analysis.series;
  const valid = rows.filter((row: AnyRecord) => typeof row.value === 'number');
  if (!valid.length) return <div className="empty-chart">No valid values. Inspect the acquisition and quality report.</div>;
  const dates = analysis.series.map((row: AnyRecord) => Date.parse(row.date));
  const minTime = Math.min(...dates), maxTime = Math.max(...dates);
  const values = valid.map((row: AnyRecord) => row.value); let min = Math.min(...values), max = Math.max(...values);
  const margin = (max-min || 1)*.12; min -= margin; max += margin;
  const x = (date: string) => 65 + (Date.parse(date)-minTime)/(maxTime-minTime || 1)*795;
  const y = (value: number) => 260 - (value-min)/(max-min)*230;
  function line(data: AnyRecord[]) { let path = '', gap = true; for (const row of data) { if (typeof row.value !== 'number') { gap = true; continue; } path += `${gap ? 'M' : 'L'}${x(row.date).toFixed(2)},${y(row.value).toFixed(2)} `; gap = false; } return path; }
  const fitted = adjusted ? analysis.fitted.map((row: AnyRecord) => { const raw = analysis.series.find((item: AnyRecord) => item.date === row.date), anomaly = analysis.anomalies.find((item: AnyRecord) => item.date === row.date); return { date: row.date, value: row.value - (raw.value-anomaly.value) }; }) : analysis.fitted;
  const ticks = Array.from({ length: 5 }, (_, i) => min+(max-min)*i/4);
  return <>
<div className="chart-toolbar">
<div className="chart-legend">
<span className="legend-dot jade"/>{adjusted ? 'Seasonally adjusted values' : 'Source values'}<span className="legend-dot gold"/>Fitted model</div>
<button className={`chart-toggle ${adjusted ? 'selected' : ''}`} onClick={() => setAdjusted(!adjusted)} disabled={analysis.specification.frequency !== 'monthly'}>Seasonal adjustment</button>
</div>
<svg className="trend-chart" viewBox="0 0 900 310" role="img" aria-label={`Real ${artifact.acquisition.variable.name} time series and fitted trend. No rendered imagery is used as numerical data.`}>{ticks.map((tick, i) => <g key={i}>
<path className="chart-grid" d={`M65 ${y(tick)}H860`}/>
<text x="48" y={y(tick)+4} textAnchor="end">{number(tick)}</text>
</g>)}{[0,.25,.5,.75,1].map(fraction => <text key={fraction} x={65+795*fraction} y="288" textAnchor="middle">{new Date(minTime+(maxTime-minTime)*fraction).getUTCFullYear()}</text>)}<path className="observed-line" d={line(rows)}/>
<path className="fitted-line" d={line(fitted)}/>
</svg>
<div className="chart-caption">
<span>{artifact.acquisition.variable.units} · {analysis.specification.frequency} series</span>
<span>Missing observations remain gaps. No imputation.</span>
</div>
</>;
}

function LocationMap({ geometry }: { geometry: AnyRecord }) {
  const lat = geometry.latitude ?? geometry.site?.latitude, lon = geometry.longitude ?? geometry.site?.longitude;
  return <div className="location-map">
<svg viewBox="0 0 320 130" aria-label="Geographic coordinate grid, not a high-resolution land-cover map" role="img">
<defs>
<pattern id="graticule" width="32" height="26" patternUnits="userSpaceOnUse">
<path d="M32 0H0V26" fill="none" stroke="#26332d" strokeWidth=".6"/>
</pattern>
</defs>
<rect width="320" height="130" fill="url(#graticule)"/>{typeof lat === 'number' && <g transform={`translate(${(lon+180)/360*320},${(90-lat)/180*130})`}>
<circle r="14" fill="#7de3bc" opacity=".12"/>
<circle r="4" fill="#7de3bc"/>
<path d="M-22 0H22M0-22V22" stroke="#7de3bc" strokeWidth=".6"/>
</g>}</svg>
<div>
<GlobeHemisphereWest size={17}/>
<span>{typeof lat === 'number' ? `${Math.abs(lat).toFixed(2)}° ${lat<0?'S':'N'} · ${Math.abs(lon).toFixed(2)}° ${lon<0?'W':'E'}` : 'Imported support: user-declared'}</span>
</div>
</div>;
}

function Evidence({ session }: { session: AnyRecord }) {
  const [artifactID, setArtifactID] = useState('');
  const artifact = session.artifacts.find((item: AnyRecord) => item.id === artifactID) || session.artifacts.at(-1);
  if (!artifact) return <section className="empty-evidence">
<ChartLineUp size={44} weight="thin"/>
<div className="eyebrow">MEASURE BEFORE YOU EXPLAIN</div>
<h2>Every finding<br/>starts with evidence.</h2>
<p>Select a NASA variable and a place. The actual series,<br/>its rate of change and uncertainty will appear here.</p>
</section>;
  const { acquisition, analysis } = artifact, units = acquisition.variable.units;
  const detected = analysis.status === 'detected';
  return <section className="evidence-view">
<header className="evidence-header">
<div>
<div className="eyebrow">MEASURED CHANGE / {acquisition.variable.provider}</div>
<h1>{acquisition.variable.name}</h1>
<p className="muted">{acquisition.geometry.label} <span className="separator">/</span> {analysis.requested_start.slice(0,4)}–{analysis.requested_end.slice(0,4)}</p>
</div>
<a className="secondary" href={`/api/export/${session.id}`} download>
<DownloadSimple size={17}/>Export investigation</a>
</header>
{session.artifacts.length > 1 && <label className="artifact-history">Evidence record <select value={artifact.id} onChange={event => setArtifactID(event.target.value)} aria-label="Evidence record">{session.artifacts.map((item: AnyRecord) => <option key={item.id} value={item.id}>{item.acquisition.variable.name} / {item.acquisition.geometry.label} / {item.analysis.status.replaceAll('_', ' ')}</option>)}</select></label>}
<div className="finding-strip">
<span className={`finding-icon ${detected?'positive':''}`}>{detected ? <ChartLineUp size={22}/> : <Compass size={22}/>}</span>
<div>
<strong>{detected ? 'A statistically detectable trend' : analysis.status === 'not_detected' ? 'No statistically detectable linear trend' : analysis.status === 'descriptive_only' ? 'A descriptive rate, not a significance claim' : 'The evidence is inconclusive'}</strong>
<p>{detected ? 'Under the declared model and uncertainty assumptions. This does not establish a cause.' : 'An uncertain or nonsignificant result is still a useful measurement.'}</p>
</div>
<span className="badge">{acquisition.variable.evidence_class.replaceAll('_',' ')}</span>
</div>
<div className="metric-grid">
<div>
<span>CHANGE PER DECADE</span>
<strong>{number(analysis.slope_per_decade,4)}<small>{units}</small>
</strong>
</div>
<div>
<span>95% SLOPE INTERVAL / YEAR</span>
<strong className="interval">{analysis.interval ? `${number(analysis.interval[0],4)} to ${number(analysis.interval[1],4)}` : 'Not reported'}</strong>
<small>{analysis.interval ? `${units} / year` : 'Inference requirements not met'}</small>
</div>
<div>
<span>SIGNIFICANCE</span>
<strong>p {analysis.p_value == null ? '—' : analysis.p_value < .0001 ? '< 0.0001' : `= ${number(analysis.p_value,4)}`}</strong>
<small>Two-sided · α = 0.05</small>
</div>
<div>
<span>VALID OBSERVATIONS</span>
<strong>{analysis.n}<small>/{analysis.n+analysis.missing}</small>
</strong>
<small>{analysis.missing} missing · {analysis.specification.frequency}</small>
</div>
</div>
<div className="chart-section">
<div className="section-heading">
<h3>The record, not just the result.</h3>
<span className="micro">REGRESSION + DEPENDENCE-AWARE UNCERTAINTY</span>
</div>
<TrendChart artifact={artifact}/>
</div>
<div className="evidence-bottom">
<div>
<div className="eyebrow">WHERE THIS FINDING APPLIES</div>
<h3>{acquisition.geometry.label}</h3>
<p>{acquisition.variable.support}</p>
<LocationMap geometry={acquisition.geometry}/>
</div>
<div className="method-panel">
<div className="eyebrow">HOW TO READ THIS</div>
<h3>Significance is not certainty.</h3>
<p>The slope describes direction and size. Its interval reflects statistical uncertainty under a specific model—not the probability that an explanation is true.</p>
<details>
<summary>Method & diagnostic checks <CaretDown/>
</summary>
<dl>
<dt>Method</dt>
<dd>{analysis.specification.method}</dd>
<dt>HAC bandwidth</dt>
<dd>{analysis.specification.bandwidth} {analysis.specification.frequency === 'monthly' ? 'months' : 'years'}</dd>
<dt>Coverage</dt>
<dd>{number((analysis.diagnostics.coverage || 0)*100)}%</dd>
<dt>Bandwidth sensitive</dt>
<dd>{String(analysis.diagnostics.bandwidth_sensitive ?? 'not tested')}</dd>
<dt>Input checksum</dt>
<dd className="hash">{analysis.inputs_sha256}</dd>
</dl>
</details>
<details>
<summary>Sources & limitations <CaretDown/>
</summary>
<p>{acquisition.variable.definition}</p>
<ul>{analysis.limitations.map((text: string, i: number) => <li key={i}>{text}</li>)}</ul><SourceLinks sources={[acquisition.variable.source, ...analysis.sources]}/></details>
</div>
</div>
<div className="next-evidence">
<Flask size={23}/>
<div>
<strong>Interpretation and additional evidence</strong>
<p>A trend alone cannot distinguish weather, disturbance, management or observation changes. Compare explicit expectations and seek an observation that could challenge them.</p>
</div>
</div>
<WorkflowPanel session={session}/>
</section>;
}

function WorkflowPanel({session}:{session:AnyRecord}) {
  const [tab,setTab]=useState('investigation'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [model,setModel]=useState('seasonal_continuation_v1'),[covariate,setCovariate]=useState('');
  const target=session.artifacts.at(-1);
  async function action(path:string,input:AnyRecord={}) {setBusy(true);setError('');try{await api(path,{sessionID:session.id,...input});}catch(failure){setError((failure as Error).message);}finally{setBusy(false);}}
  const semantic=session.semanticReviews?.at(-1),simulation=session.simulations?.at(-1),update=session.evidenceUpdates?.at(-1);
  return <section className="workflow-panel">
    <div className="section-heading"><div><div className="eyebrow">HYPOTHESES AND OBSERVATIONS</div><h3>Evaluate competing explanations</h3></div><span className="badge">Evidence-linked assessment</span></div>
    <nav className="workflow-tabs" aria-label="Investigation detail">{['investigation','models','review','trace'].map(value=><button key={value} className={tab===value?'active':''} onClick={()=>setTab(value)}>{value==='review'?'Jev review':value.charAt(0).toUpperCase()+value.slice(1)}</button>)}</nav>
    {tab==='investigation' && <div>
      {!session.hypothesisRecords?.length ? <p>Ask GAIA a specific question in Conversation. The actual coordinator will select relevant specialists, inspect the scoped evidence, and propose competing registered expectations.</p> : <>
        <div className="hypothesis-grid">{session.hypothesisRecords.map((record:AnyRecord)=><article key={record.id}><span className="eyebrow">{record.owner.toUpperCase()} / QUALITATIVE EXPECTATION</span><h4>{record.name}</h4><p>{record.expectation}</p><p className="muted">What could weaken it: {record.contradiction}</p><div className="signature-list">{record.evidence.map((result:AnyRecord,i:number)=><span className="badge" key={i}>{result.status.replaceAll('_',' ')}</span>)}</div><SourceLinks sources={[record.source]}/></article>)}</div>
        {session.observationPlan && <div className="observation-protocol"><div className="eyebrow">THE NEXT DISTINGUISHING OBSERVATION</div><h4>{session.observationPlan.name}</h4><p>{session.observationPlan.support} {session.observationPlan.timing}</p><dl><dt>Under one explanation</dt><dd>{session.observationPlan.under_a}</dd><dt>Under the alternative</dt><dd>{session.observationPlan.under_b}</dd></dl><p className="muted">{session.observationPlan.limitation}</p><SourceLinks sources={[session.observationPlan.source]}/>{session.observationPlan.operation==='power'?<button className="primary" disabled={busy} onClick={()=>action('observation/get')}>Get evidence and update</button>:<p className="badge">{session.observationPlan.availability.replaceAll('_',' ')} / use a lawful import or qualified observation</p>}</div>}
        {update && <div className="update-record"><h4>Evidence update retained</h4><p>{update.reason}</p><span className="badge">{update.mode.replaceAll('_',' ')}</span><p className="micro">Before: {update.before.artifacts.length} records. After: {session.artifacts.length} records. An unchanged or unresolved assessment is retained honestly.</p></div>}
      </>}
    </div>}
    {tab==='models' && <div className="model-workspace"><p>Fixed implementations, chronological held-out checks, and explicit limits. A conditional range is not a probability of cause.</p><label>Model<select value={model} onChange={event=>setModel(event.target.value)}><option value="seasonal_continuation_v1">Seasonal statistical continuation</option><option value="response_emulator_v1">Conditional environmental-response emulator</option></select></label>{model==='response_emulator_v1' && <label>Measured covariate<select value={covariate} onChange={event=>setCovariate(event.target.value)}><option value="">Select an actually acquired compatible record</option>{session.artifacts.filter((item:AnyRecord)=>item.id!==target?.id).map((item:AnyRecord)=><option value={item.id} key={item.id}>{item.acquisition.variable.name}</option>)}</select></label>}<button className="primary" disabled={busy || !target || (model==='response_emulator_v1'&&!covariate)} onClick={()=>action('simulate',{artifactID:target.id,model,covariateIDs:covariate?[covariate]:[],members:64,seed:20261114,horizon:target.acquisition.frequency==='annual'?2:12})}>Run bounded model</button>
      {simulation && <div className="simulation-result"><h4>{simulation.model.replaceAll('_',' ')}</h4><span className="badge">{simulation.readiness.replaceAll('_',' ')}</span><p>{simulation.uncertainty_label}</p><table><thead><tr><th>Held-out model / baseline</th><th>RMSE</th><th>MAE</th></tr></thead><tbody>{Object.entries(simulation.validation?.metrics||{}).map(([name,value])=><tr key={name}><td>{name.replaceAll('_',' ')}</td><td>{number((value as AnyRecord).rmse,4)}</td><td>{number((value as AnyRecord).mae,4)}</td></tr>)}</tbody></table><ScenarioChart result={simulation}/><ul>{simulation.limitations.map((text:string)=><li key={text}>{text}</li>)}</ul></div>}
      <p className="muted">Water buckets are illustrative. Hydraulic routing, movement, transmission and ecological competition require their own observations, solvers and validation; they are not secretly represented by a drought model.</p>
    </div>}
    {tab==='review' && <div>{!semantic?<p>No Jev review has run for this investigation. Ask GAIA an evidence question to execute and record the real typed review.</p>:<><div className="section-heading"><h4>{semantic.model || 'TypeSafe unavailable'}</h4><span className="badge">{semantic.status} / {semantic.influence}</span></div><p>Semantic fit and source-context judgments are experimental. They do not compute significance, establish causes, or override physical support checks.</p><table><thead><tr><th>Judgment</th><th>Typed answer</th><th>Model confidence</th></tr></thead><tbody>{Object.entries(semantic.answers||{}).map(([id,value])=>{const item=value as AnyRecord;return <tr key={id}><td>{id}</td><td>{item.choice ?? number(item.noul ?? item.score,3)}</td><td>{item.confidence===undefined?'Not supplied for Noul':number(item.confidence,3)}</td></tr>;})}</tbody></table><p className="micro">{semantic.elapsed_ms} ms / integration is not independent domain validation / evaluation remains internal or not evaluated.</p></>}</div>}
    {tab==='trace' && <div className="trace-records"><p>Actual persisted events and approved tool receipts only. No private reasoning, instructions or credentials.</p>{session.taskGraph && <p className="micro">Outcome owner: {session.taskGraph.owner.toUpperCase()} / {session.taskGraph.transport}</p>}{session.events.slice(-30).map((item:AnyRecord)=><div key={item.id}><span className="micro">{item.sequence} / {item.type} {item.role?.toUpperCase()}</span><p>{item.summary}</p><time>{new Date(item.time).toLocaleTimeString()}</time></div>)}{Object.values(session.roleSummaries||{}).flatMap((item:any)=>item.trace||[]).map((item:AnyRecord)=><div key={item.id}><span className="micro">{item.role.toUpperCase()} / gaia_{item.tool}</span><p>{JSON.stringify(item.output)}</p></div>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}{busy && <p className="busy-line">Waiting for the actual operation, not a simulated result…</p>}
  </section>;
}

function ScenarioChart({result}:{result:AnyRecord}) {
  const rows=result.series || []; if(!rows.length) return null;
  const min=Math.min(...rows.map((row:AnyRecord)=>row.low)),max=Math.max(...rows.map((row:AnyRecord)=>row.high));
  const x=(index:number)=>40+index/Math.max(rows.length-1,1)*640,y=(value:number)=>175-(value-min)/Math.max(max-min,.00001)*140;
  const path=(key:string)=>rows.map((row:AnyRecord,index:number)=>`${index?'L':'M'}${x(index)},${y(row[key])}`).join(' ');
  const area=path('high')+rows.slice().reverse().map((row:AnyRecord,index:number)=>`L${x(rows.length-1-index)},${y(row.low)}`).join(' ')+' Z';
  return <figure className="scenario-chart"><svg viewBox="0 0 720 220" role="img" aria-label="Conditional simulation median and illustrative scenario range"><path d={area} fill="#7de3bc" fillOpacity=".12"/><path d={path('value')} fill="none" stroke="#7de3bc" strokeWidth="2"/><text x="40" y="205" fill="#8a9a94" fontSize="12">{rows[0].date}</text><text x="580" y="205" fill="#8a9a94" fontSize="12">{rows.at(-1).date}</text></svg><figcaption>Conditional continuation / {result.units}. Illustrative scenario quantiles, not calibrated confidence.</figcaption></figure>;
}

function InvestigateForm({ session, catalog, onRefresh, onStarted }: { session: AnyRecord; catalog: AnyRecord; onRefresh: () => void; onStarted: () => void }) {
  const [variable, setVariable] = useState('T2M'), [label, setLabel] = useState('British Columbia, interior plateau'), [latitude, setLatitude] = useState('53.91'), [longitude, setLongitude] = useState('-122.75');
  const [start, setStart] = useState('2001'), [end, setEnd] = useState('2025'), [sites, setSites] = useState<AnyRecord[]>([]), [siteid, setSite] = useState(''), [siteSearch, setSiteSearch] = useState('Canada');
  const [csv, setCsv] = useState(''), [source, setSource] = useState(''), [units, setUnits] = useState(''), [frequency, setFrequency] = useState('monthly');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const selected = catalog.variables?.find((item: AnyRecord) => item.id === variable);
  async function loadSites() { setBusy(true); setError(''); try { const data = await api('sites'); setSites(data.sites); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); } }
  async function run(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('analyze', { sessionID: session.id, operation: variable === 'import' ? 'import' : variable === 'EVI' ? 'modis' : 'power', variable, label, latitude: Number(latitude), longitude: Number(longitude), start: Number(start), end: Number(end), siteid, months: [5,6,7,8,9], csv, source, units, frequency, domain: 'aura', support: label }); onRefresh(); onStarted(); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  const filteredSites = sites.filter(site => `${site.sitename} ${site.siteid} ${site.country} ${site.state}`.toLowerCase().includes(siteSearch.toLowerCase())).slice(0,100);
  return <form className="investigation-form" onSubmit={run}>
<div className="eyebrow">START WITH A MEASURED CHANGE</div>
<h3>What would you like to inspect?</h3>
<label>Variable<select value={variable} onChange={event => setVariable(event.target.value)}>{catalog.variables?.map((item: AnyRecord) => <option key={item.id} value={item.id}>{item.name} · {item.provider}</option>)}<option value="import">Import a licensed time series</option>
</select>
</label>{selected && <p className="variable-definition">{selected.definition}</p>}<label>Place / physical support<input value={label} onChange={event => setLabel(event.target.value)}/>
</label>
    {variable === 'import' ? <>
<label>CSV: date,value<textarea value={csv} onChange={event => setCsv(event.target.value)} placeholder="Paste an actual licensed/exported series, not example numbers" rows={4}/>
</label>
<label>Source URL or citation<input value={source} onChange={event => setSource(event.target.value)} required/>
</label>
<div className="form-row">
<label>Units<input value={units} onChange={event => setUnits(event.target.value)} required/>
</label>
<label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value)}>
<option>monthly</option>
<option>annual</option>
</select>
</label>
</div>
</> : <>
<div className="form-row">
<label>Latitude<input type="number" step="any" min="-90" max="90" value={latitude} onChange={event => setLatitude(event.target.value)} required/>
</label>
<label>Longitude<input type="number" step="any" min="-180" max="180" value={longitude} onChange={event => setLongitude(event.target.value)} required/>
</label>
</div>
<div className="form-row">
<label>Start year<input type="number" min={variable === 'EVI' ? '2000' : '1981'} max="2025" value={start} onChange={event => setStart(event.target.value)} required/>
</label>
<label>End year<input type="number" min="1981" max="2025" value={end} onChange={event => setEnd(event.target.value)} required/>
</label>
</div>{variable === 'EVI' && <div className="site-selector">
<button className="secondary" type="button" onClick={loadSites} disabled={busy}>Load real NASA fixed sites <ArrowDown/>
</button>{sites.length > 0 && <>
<input aria-label="Filter fixed sites" value={siteSearch} onChange={event => setSiteSearch(event.target.value)} placeholder="Filter country, site or state"/>
<select value={siteid} onChange={event => { setSite(event.target.value); const site = sites.find(item => item.siteid === event.target.value); if (site) { setLatitude(String(site.latitude)); setLongitude(String(site.longitude)); setLabel(site.sitename); } }} required>
<option value="">Choose a provider-listed footprint</option>{filteredSites.map(site => <option value={site.siteid} key={site.siteid}>{site.sitename} / {site.country}</option>)}</select>
</>}<p className="micro">Predeclared May–September annual recipe. QA and all-month completeness required. This is a site footprint, not the typed boundary.</p>
</div>}</>}
    <div className="support-note">
<Compass size={16}/>{variable === 'EVI' ? '250 m posted MODIS pixels; actual returned site footprint and QA.' : variable === 'import' ? 'Imported provenance is user-declared, not independently authenticated.' : 'NASA POWER grid-supported location. Not a local station or polygon average.'}</div>
<button className="primary" disabled={busy || (variable === 'EVI' && !siteid)}>{busy ? <CircleNotch className="spin"/> : <ChartLineUp/>}{busy ? 'Preparing acquisition' : 'Acquire & analyze'}<ArrowRight/>
</button>{error && <div className="error">
<WarningCircle/>{error}</div>}<p className="micro form-footnote">Real data only. A short or incomplete record receives descriptive output—not an invented significance result.</p>
</form>;
}

function Conversation({ session, catalog, onRefresh, onEvidence }: { session: AnyRecord; catalog: AnyRecord; onRefresh: () => void; onEvidence: () => void }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function send(event: React.FormEvent) { event.preventDefault(); if (!text.trim()) return; setBusy(true); setError(''); try { await api('chat', { sessionID: session.id, text }); setText(''); onRefresh(); } catch (failure) { setError((failure as Error).message); onRefresh(); } finally { setBusy(false); } }
  return <div className="conversation-layout">
<section className="conversation">
<header>
<img src="/logos/gaia-icon.svg" alt=""/>
<div>
<h2>GAIA</h2>
<span>Your investigation partner</span>
</div>
<span className="conversation-tag">{session.depth === 'technical' ? 'Technical detail' : 'Plain language'}</span>
</header>
<div className="messages">{!session.messages.length && <div className="conversation-opening">
<div className="eyebrow">FOLLOW A QUESTION, NOT A SCRIPT</div>
<h2>What change<br/>caught your attention?</h2>
<p>You don’t need a dataset name or a statistics background. Tell me about a place or a question, or start with a measured NASA series.</p>
<div className="prompt-example" onClick={() => setText('How can I investigate whether vegetation in British Columbia has changed?')}>
<span>How has this landscape changed?</span>
<ArrowUpRight size={16}/>
</div>
</div>}{session.messages.map((message: AnyRecord) => <div className={`message ${message.role}`} key={message.id}>
<span>{message.role === 'user' ? 'YOU' : 'GAIA'}</span>
<p>{message.text}</p>{message.type && <small>{message.type}</small>}</div>)}{busy && <div className="busy-line">
<CircleNotch className="spin"/>Investigation running</div>}</div>{error && <div className="error">
<WarningCircle/>{error}</div>}<form className="composer" onSubmit={send}>
<textarea value={text} onChange={event => setText(event.target.value)} placeholder="Ask about a place, a change, a possibility…" rows={2} maxLength={4000} aria-label="Message GAIA"/>
<button aria-label="Send question" disabled={busy || !text.trim()}>
<ArrowUpRight size={22}/>
</button>
</form>
<p className="micro conversation-footnote">Model proposals are not verified findings. Numerical claims live in the evidence.</p>
</section>
<div className="investigation-rail">
<InvestigateForm session={session} catalog={catalog} onRefresh={onRefresh} onStarted={onEvidence}/>
</div>
</div>;
}

function Inspector({ id, session, onClose }: { id: string; session: AnyRecord | undefined; onClose: () => void }) {
  const role = roles.find(item => item.id === id)!;
  const summary = session?.roleSummaries?.[id];
  return <div className="modal-backdrop">
<section className="inspector modal" style={{ '--role-color': role.color } as React.CSSProperties}>
<button className="icon-button close" onClick={onClose} aria-label="Close inspector">
<X/>
</button>
<img src={`/logos/${id}-icon.svg`} alt=""/>
<div className="eyebrow">READ-ONLY FUNCTION INSPECTOR</div>
<h2>{role.name}</h2>
<p>{role.description}</p>
<div className="inspector-state">
<span className="status-dot"/>{summary ? 'Evidence summary available' : 'No domain work has run in this investigation'}</div>{summary ? <>
<h3>Approved evidence summary</h3>
<p>{summary.text}</p>
<p className="micro">{summary.source}</p>
</> : <p className="muted">GAIA requests this perspective only when it is relevant. A configured function is not an active task or evidence of expertise.</p>}<div className="inspector-boundary">
<Flask/>
<p>{id === 'zoe' ? 'Animal findings require actual identity, observations and effort. Satellite habitat is not an animal census.' : id === 'chloris' ? 'Greenness is not species, yield, infection or tree mortality. Season and observation quality matter.' : id === 'thalassa' ? 'Water compartments, depths, units and boundaries remain distinct. Rainfall is not streamflow.' : 'Air temperature, surface temperature, precipitation and atmospheric columns measure different things.'}</p>
</div>
<footer className="micro">Questions go to GAIA. This view never exposes hidden reasoning, private transcripts or credentials.</footer>
</section>
</div>;
}

function App() {
  const [status, setStatus] = useState<AnyRecord>({ sessions: [], jobs: [] }), [catalog, setCatalog] = useState<AnyRecord>({ variables: [] }), [selected, setSelected] = useState('');
  const [view, setView] = useState('system'), [setup, setSetup] = useState(false), [inspector, setInspector] = useState(''), [depth, setDepth] = useState('plain'), [error, setError] = useState('');
  const [resources, setResources] = useState(false), [sidebar, setSidebar] = useState(false);
  const refresh = async () => { try { setStatus(await api('status')); } catch (failure) { setError((failure as Error).message); } };
  useEffect(() => { refresh(); api('catalog').then(setCatalog).catch(failure => setError(failure.message)); const stream = new EventSource('/api/events'); stream.onmessage = () => refresh(); stream.onopen = () => refresh(); stream.onerror = () => setError('Live connection interrupted. Reload to restore durable investigation state; progress is not being fabricated.'); return () => stream.close(); }, []);
  const session = status.sessions.find((item: AnyRecord) => item.id === selected);
  async function create() { try { const next = await api('sessions', { depth }); setSelected(next.id); setView('system'); setSidebar(false); await refresh(); } catch (failure) { setError((failure as Error).message); } }
  async function chat() { if (!session) { const next = await api('sessions', { depth }); setSelected(next.id); await refresh(); } setView('conversation'); }
  const activeJobs = status.jobs.filter((job: AnyRecord) => job.sessionID === selected && job.status === 'running');
  const lastEvent = session?.events.at(-1);
  async function changeDepth(value: string) {
    setDepth(value);
    if (session) {
      try { await api('sessions/settings', { sessionID: session.id, depth: value }); await refresh(); }
      catch (failure) { setError((failure as Error).message); }
    }
  }
  return <div className="app-shell">
<aside className={`sidebar ${sidebar ? 'open' : ''}`}>
<Brand/>
<button className="new-session" onClick={create}>
<Plus size={18}/>
<span>New investigation</span>
<span className="shortcut">＋</span>
</button>
<div className="sidebar-section">
<span>YOUR INVESTIGATIONS</span>
<small>{status.sessions.length}</small>
</div>
<nav className="session-list">{status.sessions.length ? status.sessions.map((item: AnyRecord) => <button key={item.id} onClick={() => { setSelected(item.id); setView(item.artifacts.length ? 'evidence' : 'system'); setSidebar(false); }} className={item.id === selected ? 'active' : ''}>
<ChatCircle size={17}/>
<span>{item.title}</span>
</button>) : <div className="no-sessions">No saved investigations.</div>}</nav>
<div className="sidebar-bottom">
<button onClick={() => setResources(true)}>
<GlobeHemisphereWest size={18}/>Data & resources<ArrowUpRight size={14}/>
</button>
<button onClick={() => setSetup(true)}>
<SlidersHorizontal size={18}/>Provider & settings<small className={status.tested ? 'connected' : ''}>{status.tested ? 'Ready' : status.configured ? 'Untested' : 'Connect'}</small>
</button>
<div className="sidebar-profile">
<div className="profile-symbol">G</div>
<div>
<strong>Local workspace</strong>
<span>NASA Space Apps 2026</span>
</div>
<span className="status-dot"/>
</div>
</div>
</aside>
<main className="main">
<header className="topbar">
<button className="mobile-menu icon-button" onClick={() => setSidebar(!sidebar)} aria-label="Open navigation">
<Plus/>
</button>
<div className="breadcrumb">
<span>Workspace</span>
<span>/</span>
<strong>{session ? session.title : 'No investigation selected'}</strong>
</div>
<div className="topbar-right">
<span className="local-label">
<span className="status-dot"/>LOCAL-FIRST</span>
<button className="icon-button" onClick={() => setSetup(true)} aria-label="Provider settings">
<SlidersHorizontal size={19}/>
</button>
</div>
</header>
<div className="workspace-toolbar">
<div className="view-tabs">{[['system','System',Compass],['conversation','Conversation',ChatCircle],['evidence','Evidence',ChartLineUp]].map(([id,label,Icon]) => { const Component = Icon as React.ElementType; return <button key={id as string} onClick={() => { if (id === 'conversation') chat(); else setView(id as string); }} className={view === id ? 'active' : ''}>
<Component size={17}/>{label as string}</button>; })}</div>
<div className="depth-control">
<label htmlFor="depth-select">Explanation</label>
<select id="depth-select" value={session?.depth || depth} onChange={event => changeDepth(event.target.value)}>
<option value="plain">Plain language</option>
<option value="technical">Technical</option>
</select>
</div>
</div>{error && <div className="global-error error">
<WarningCircle/>{error}<button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error">
<X/>
</button>
</div>}<div className="workspace-content">{view === 'system' ? <Constellation onChat={chat} onInspect={setInspector}/> : view === 'conversation' && session ? <Conversation session={session} catalog={catalog} onRefresh={refresh} onEvidence={() => setView('evidence')}/> : <Evidence session={session || { artifacts: [] }}/>}{activeJobs.length > 0 && <div className="job-tray">{activeJobs.map((job: AnyRecord) => <div key={job.id}>
<CircleNotch className="spin"/>
<span>Science job · {job.operation}<small>Acquiring values and testing the declared method</small>
</span>
<button className="icon-button" onClick={async () => { await api('jobs/stop', { jobID: job.id, sessionID: selected }); refresh(); }} aria-label="Stop scientific job">
<Stop/>
</button>
</div>)}</div>}</div>
<footer className="workspace-footer">
<span>
<span className="status-dot"/>{lastEvent?.summary || 'No active investigation task'}</span>
<span>LOCAL WORKSPACE · OPENCODE 2.3.0</span>
</footer>
</main>{setup && <Setup status={status} onClose={() => setSetup(false)} onRefresh={refresh}/>} {inspector && <Inspector id={inspector} session={session} onClose={() => setInspector('')}/>} {resources && <div className="modal-backdrop">
<section className="resources modal">
<button className="icon-button close" onClick={() => setResources(false)} aria-label="Close resources">
<X/>
</button>
<div className="eyebrow">DATA ACCESS AND PROVENANCE</div>
<h2>Data sources</h2>
<p className="muted">POWER is a live registered route. MODIS availability is checked at acquisition; companion resources retain their distinct evidence roles.</p>{catalog.resources?.map((resource: AnyRecord) => <a key={resource.name} href={resource.url} target="_blank" rel="noreferrer">
<span>
<strong>{resource.name}</strong>
<p>{resource.mode}</p>
<small>{resource.note}</small>
</span>
<ArrowUpRight/>
</a>)}</section>
</div>}</div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode>
<App/>
</React.StrictMode>);
