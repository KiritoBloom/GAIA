import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { ROOT, isolateEnvironment } from './environment.mjs';
import { agentConfiguration } from './agents.mjs';
import { safeEndpoint, validRole } from './security.mjs';

isolateEnvironment();
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

let host, creating, selected;
const bindings = new Map();
const receipts = [];
const artifacts = new Map();
const traces = [];
let scientificAccess;
const providerID = 'gaia-local-provider';
export function registerScientificAccess(access) { scientificAccess = access; }
export function toolTrace(investigationID) { return traces.filter(item=>item.investigationID === investigationID); }
function trace(binding, context, tool, output) { traces.push({ id:randomUUID(), investigationID:binding.investigationID, role:binding.role, threadID:context.sessionID, tool, output, time:new Date().toISOString() }); if(traces.length>1000) traces.shift(); }

export function providerStatus() {
  return { configured: !!selected, provider: selected?.name, endpoint: selected?.endpoint, model: selected?.model, tested: selected?.tested ?? false, local_configuration_available: !!(process.env.FreeGG_API_KEY || process.env.LLM_KEY), sdk_version: '2.3.0', transport: 'application-managed specialist sessions' };
}

export async function discoverModels(input) {
  const endpoint = safeEndpoint(input.endpoint);
  if (input.key !== undefined && (typeof input.key !== 'string' || input.key.length > 2048)) throw new Error('Invalid provider credential.');
  const response = await fetch(`${endpoint}/models`, { headers: input.key ? { authorization: `Bearer ${input.key}` } : {}, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`Provider model discovery returned HTTP ${response.status}. Credentials were not logged.`);
  if (!response.headers.get('content-type')?.includes('json')) throw new Error('This endpoint returned a web page, not a model API. Use the provider’s compatible API base (usually ending in /v1).');
  const data = await response.json();
  if (!Array.isArray(data.data)) throw new Error('Endpoint did not return a supported OpenAI-compatible model catalog.');
  return { models: data.data.map(item => item.id).filter(id => typeof id === 'string' && id.length <= 180).slice(0, 500), endpoint };
}

export function localProvider() {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const endpoints = { openai: 'https://api.openai.com/v1', openrouter: 'https://openrouter.ai/api/v1' };
  let endpoint = process.env.FreeGG_BASE_URL || endpoints[provider];
  if (endpoint && new URL(endpoint).hostname === 'freegg.app' && new URL(endpoint).pathname === '/') endpoint = new URL('/v1', endpoint).toString();
  if (!endpoint) throw new Error('This folder does not specify a supported provider endpoint; enter it in the masked setup form.');
  return { name: process.env.FreeGG_BASE_URL ? 'FreeGG' : provider, endpoint, key: process.env.FreeGG_API_KEY || process.env.LLM_KEY };
}

export async function configureProvider(input) {
  const endpoint = safeEndpoint(input.endpoint);
  if (input.key !== undefined && (typeof input.key !== 'string' || input.key.length > 2048)) throw new Error('Invalid provider credential.');
  if (typeof input.model !== 'string' || !input.model || input.model.length > 180 || /\s/.test(input.model)) throw new Error('Choose an explicit provider model identifier.');
  if (typeof input.name !== 'string' || input.name.length > 80) throw new Error('Invalid provider label.');
  if (host) await host.close();
  host = undefined; creating = undefined; bindings.clear();
  selected = { name: input.name, endpoint, model: input.model, tested: false };
  // Session-only credential, scoped to this backend process. Never persisted,
  // returned to the browser or included in an agent prompt.
  process.env.GAIA_PROVIDER_KEY = input.key || '';
  return providerStatus();
}

export async function ensureRuntime() {
  if (host) return host;
  if (!selected) throw new Error('Connect a provider before using GAIA conversation. Numerical analysis needs no model key.');
  if (creating) return creating;
  creating = (async () => {
    const { OpenCode } = await import('@opencode/sdk');
    const { Plugin } = await import('@opencode/plugin');
    const plugin = Plugin.define({ id: 'gaia-scientific-boundary', async setup(ctx) {
      await ctx.tool.transform(editor => {
        editor.add({ name: 'proof', description: 'Fixed role-isolation proof: return the exact nonce and sum of bounded integers. Not an Earth science result.', options: { namespace: 'gaia', codemode: false }, input: { type: 'object', properties: { nonce: { type: 'string', maxLength: 80 }, values: { type: 'array', maxItems: 16, items: { type: 'integer', minimum: -1000, maximum: 1000 } } }, required: ['nonce', 'values'], additionalProperties: false }, async execute(input, context) {
          const binding = bindings.get(context.sessionID);
          if (!binding || binding.role !== context.agent || !validRole(context.agent)) throw new Error('Role/session binding denied.');
          const receipt = { nonce: input.nonce, sum: input.values.reduce((a, b) => a+b, 0), role: context.agent, sessionID: context.sessionID, time: new Date().toISOString() };
          receipts.push(receipt);
          return { content: JSON.stringify(receipt) };
        }});
        editor.add({ name: 'evidence', description: 'Read the small approved numerical evidence summary owned by the current investigation. No raw files or secret access.', options: { namespace: 'gaia', codemode: false }, input: { type: 'object', properties: {}, additionalProperties: false }, async execute(_input, context) {
          const binding = bindings.get(context.sessionID);
          if (!binding || binding.role !== context.agent) throw new Error('Evidence role/session binding denied.');
          const owned = scientificAccess?.read(binding.investigationID);
          if (owned) {
            const summaries = owned.artifacts.map(evidence=>({ id:evidence.id,variable:evidence.acquisition.variable,geometry:evidence.acquisition.geometry,status:evidence.analysis.status,slope_per_year:evidence.analysis.slope_per_year,interval:evidence.analysis.interval,p_value:evidence.analysis.p_value,n:evidence.analysis.n,limitations:evidence.analysis.limitations,sources:evidence.analysis.sources }));
            trace(binding,context,'evidence',{artifactIDs:summaries.map(item=>item.id)});
            return { content:JSON.stringify({artifacts:summaries,observation_plan:owned.observationPlan || null}) };
          }
          const evidence = artifacts.get(binding.investigationID);
          trace(binding,context,'evidence',{artifactIDs:evidence ? [evidence.id] : []});
          if (!evidence) return { content: 'No acquired evidence. Ask one concrete question; no numerical findings exist.' };
          const { acquisition, analysis } = evidence;
          return { content: JSON.stringify({ id: evidence.id, variable: acquisition.variable, geometry: acquisition.geometry, status: analysis.status, slope_per_year: analysis.slope_per_year, slope_per_decade: analysis.slope_per_decade, interval: analysis.interval, p_value: analysis.p_value, n: analysis.n, missing: analysis.missing, limitations: analysis.limitations, sources: [acquisition.provenance.url || acquisition.provenance.source, ...analysis.sources] }) };
        }});
        editor.add({ name:'catalog',description:'Read only this function’s source/observable catalog and registered observation protocols. Listed sources are not automatically implemented.',options:{namespace:'gaia',codemode:false},input:{type:'object',properties:{},additionalProperties:false},async execute(_input,context){
          const binding=bindings.get(context.sessionID);
          if(!binding || binding.role!==context.agent) throw new Error('Catalog role/session binding denied.');
          const data = scientificAccess ? await scientificAccess.catalog(binding.role) : {role:binding.role,variable_state:'Synthetic integration mode; no scientific catalog attached.'};
          trace(binding,context,'catalog',{role:binding.role}); return {content:JSON.stringify(data)};
        }});
        editor.add({ name:'acquire',description:'Acquire one approved NASA POWER variable for this investigation’s already authorized focal location and interval. AURA only. Deterministic service returns real numerical artifacts.',options:{namespace:'gaia',codemode:false},input:{type:'object',properties:{variable:{type:'string',enum:['T2M','PRECTOTCORR','RH2M']}},required:['variable'],additionalProperties:false},async execute(input,context){
          const binding=bindings.get(context.sessionID);
          if(!binding || binding.role!==context.agent || binding.role!=='aura' || !scientificAccess) throw new Error('Domain acquisition denied.');
          const evidence=await scientificAccess.acquire(binding.investigationID,input.variable,context.signal);
          trace(binding,context,'acquire',{artifactID:evidence.id,variable:input.variable,status:evidence.analysis.status});
          return {content:JSON.stringify({id:evidence.id,variable:evidence.acquisition.variable,status:evidence.analysis.status,slope_per_year:evidence.analysis.slope_per_year,interval:evidence.analysis.interval,p_value:evidence.analysis.p_value,limitations:evidence.analysis.limitations})};
        }});
      });
    }});
    const config = { default_agent: 'gaia', model: `${providerID}/${selected.model}`, snapshots: false, warming: {}, agents: agentConfiguration(), permissions: [{ action: '*', resource: '*', effect: 'deny' }], providers: { [providerID]: { name: selected.name, env: ['GAIA_PROVIDER_KEY'], package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: selected.endpoint }, models: { [selected.model]: { name: selected.model, modelID: selected.model, tools: true } } } } };
    host = await OpenCode.create({ plugins: [plugin], database: { path: resolve(ROOT, '.runtime/data/gaia-opencode.sqlite') }, config: { project: false, claude: false, directory: resolve(ROOT, '.runtime/config'), content: JSON.stringify(config) }, fs: { filewatcher: false, fff: false }, log: { level: 'error', emit() {} } });
    return host;
  })();
  try { return await creating; } catch (error) { creating = undefined; throw error; }
}

export function setEvidence(investigationID, evidence) { artifacts.set(investigationID, evidence); }

export async function createRoleSession(role, investigationID) {
  if (!validRole(role)) throw new Error('Unknown scientific function.');
  const runtime = await ensureRuntime();
  const session = await runtime.sessions.create({ agent: role, model: { providerID, id: selected.model }, location: { directory: ROOT }, title: `${role.toUpperCase()} / investigation` });
  bindings.set(session.id, { role, investigationID });
  return session.id;
}

export async function promptRole(sessionID, role, text, signal) {
  if (bindings.get(sessionID)?.role !== role) throw new Error('Foreign role/thread continuation denied.');
  const runtime = await ensureRuntime();
  await runtime.sessions.prompt({ sessionID, text }, { signal });
  await runtime.sessions.wait({ sessionID }, { signal });
  const context = await runtime.sessions.context({ sessionID }, { signal });
  return context;
}

export async function proveRuntime() {
  const id = randomUUID();
  const signal = AbortSignal.timeout(90_000);
  const before = receipts.length;
  for (const role of ['gaia', 'aura', 'thalassa', 'chloris', 'zoe']) {
    const sessionID = await createRoleSession(role, id);
    const nonce = `${role}-${randomUUID()}`;
    await promptRole(sessionID, role, `Integration test, not science. Call the gaia_proof tool with nonce ${JSON.stringify(nonce)} and values [3,5,-2]. Do not simulate the tool. Then reply only "complete".`, signal);
    if (!receipts.some(receipt => receipt.sessionID === sessionID && receipt.role === role && receipt.nonce === nonce && receipt.sum === 6)) throw new Error(`${role.toUpperCase()} did not execute the exact bounded tool round trip. Provider tools remain unverified.`);
    try { await promptRole(sessionID, role === 'aura' ? 'zoe' : 'aura', 'Wrong-role access test', signal); throw new Error('Wrong-role test unexpectedly allowed.'); } catch (error) { if (!error.message.includes('Foreign role/thread')) throw error; }
  }
  selected.tested = true;
  return { sdk_version: '2.3.0', transport: 'application-managed specialist sessions', roles: receipts.slice(before), tested: true, limitation: 'Synthetic role/tool proof, not domain or ecological validation.' };
}

export async function stopRuntimeSession(sessionID) {
  if (host && bindings.has(sessionID)) await host.sessions.interrupt({ sessionID, resume: false });
}
export async function closeRuntime() { if (host) await host.close(); host = undefined; creating = undefined; bindings.clear(); }
export async function removeProvider() { await closeRuntime(); selected = undefined; delete process.env.GAIA_PROVIDER_KEY; return providerStatus(); }
