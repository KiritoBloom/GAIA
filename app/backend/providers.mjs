import { safeEndpoint, sha256 } from './security.mjs';

export const protocols = Object.freeze({
  responses: { name: 'OpenAI Responses', endpoint: 'https://api.openai.com/v1', package: '@opencode/ai/providers/openai-compatible/responses' },
  chat: { name: 'OpenAI Chat / compatible', endpoint: 'https://api.openai.com/v1', package: '@opencode/ai/providers/openai-compatible' },
  anthropic: { name: 'Anthropic Messages', endpoint: 'https://api.anthropic.com/v1', package: '@opencode/ai/providers/anthropic-compatible' },
});
const catalogURL = 'https://models.dev/experimental/v2.0/api.json?type=chat';
export const anthropicVersion = '2026-10-21';
let metadataFlight, metadata, metadataTime = 0;
const inventories = new Map();

export function providerInput(input = {}) {
  if (input.protocol && !Object.hasOwn(protocols, input.protocol)) throw Error('Choose a supported API type.');
  const endpoint = safeEndpoint(input.endpoint || protocols[input.protocol || 'responses']?.endpoint);
  const host = new URL(endpoint).hostname.toLowerCase();
  const protocol = input.protocol || (host === 'api.anthropic.com' ? 'anthropic' : host === 'api.openai.com' || host === 'freegg.app' || host.endsWith('.freegg.app') ? 'responses' : 'chat');
  if (!Object.hasOwn(protocols, protocol)) throw Error('Choose a supported API type.');
  if (host === 'api.anthropic.com' && protocol !== 'anthropic' || host === 'api.openai.com' && protocol === 'anthropic') throw Error('Choose the native API type that matches this official provider endpoint.');
  if (input.key !== undefined && typeof input.key !== 'string') throw Error('Invalid provider credential.');
  if (input.key && /[\r\n\x00]/.test(input.key)) throw Error('A provider credential cannot contain line breaks or null characters.');
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : host;
  if (name.length > 100 || /[\r\n\x00]/.test(name) || input.key && name.includes(input.key)) throw Error('Invalid provider label.');
  return { endpoint, protocol, name, key: input.key || '' };
}

export function providerPackage(input) {
  const native = new URL(input.endpoint).hostname;
  if (native === 'api.anthropic.com' && input.protocol === 'anthropic') return '@opencode/ai/providers/anthropic';
  if (native === 'api.openai.com') return input.protocol === 'chat' ? '@opencode/ai/providers/openai/chat' : '@opencode/ai/providers/openai/responses';
  return protocols[input.protocol].package;
}

async function modelMetadata(fetcher) {
  if (metadata && Date.now() - metadataTime < 300_000) return metadata;
  if (metadataFlight) return metadataFlight;
  metadataFlight = (async () => {
    try {
      const response = await fetcher(catalogURL, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!response.ok) return null;
      const text = await response.text();
      if (text.length > 24_000_000) return null;
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      metadata = data; metadataTime = Date.now();
      return data;
    } catch { return null; }
    finally { metadataFlight = undefined; }
  })();
  return metadataFlight;
}

const supported = value => value === true || value?.supported === true;
const positive = value => Number.isInteger(value) && value > 0 ? value : undefined;
const title = id => ({ none: 'Off', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Maximum', minimal: 'Minimal', adaptive: 'Adaptive' }[id] || id);

// Only explicit producer/catalogue controls become selectable variants. Unknown
// models keep their provider default, rather than receiving invented effort levels.
export function thinkingVariants(protocol, reasoning, limit = {}, types) {
  if (!reasoning?.supported) return [];
  reasoning = { ...reasoning, effort: Array.isArray(reasoning.effort) ? reasoning.effort.filter(value => typeof value === 'string') : [] };
  const result = [], add = (id, settings, label = title(id)) => {
    if (!result.some(item => item.id === id)) result.push({ id, name: label, settings });
  };
  if (protocol !== 'anthropic') {
    for (const effort of reasoning.effort || []) {
      if (effort === 'default' || !/^[a-z][a-z0-9_-]*$/.test(effort)) continue;
      add(effort, { reasoningEffort: effort });
    }
    return result;
  }
  const adaptive = types ? supported(types.adaptive) : reasoning.effort.length > 0 && !reasoning.budget;
  const manual = types ? supported(types.enabled) : !!reasoning.budget;
  if (types ? supported(types.disabled) : reasoning.toggle) add('none', { thinking: { type: 'disabled' } });
  if (adaptive) {
    add('adaptive', { thinking: { type: 'adaptive' } });
    for (const effort of reasoning.effort || []) {
      if (effort !== 'default' && effort !== 'none' && /^[a-z][a-z0-9_-]*$/.test(effort)) add(effort, { thinking: { type: 'adaptive' }, effort });
    }
  } else if (manual) {
    const ceiling = Math.min(positive(limit.output) || 32_000, 32_000);
    const maximum = Math.min(positive(reasoning.budget?.max) || ceiling - 1, ceiling - 1);
    const minimum = Math.max(positive(reasoning.budget?.min) || 1024, 1024);
    if (maximum >= minimum) {
      const high = Math.min(Math.max(minimum, Math.floor((maximum + 1) / 2)), maximum);
      for (const effort of reasoning.effort || []) {
        if (effort !== 'default' && effort !== 'none' && /^[a-z][a-z0-9_-]*$/.test(effort)) add(effort, { thinking: { type: 'enabled', budgetTokens: high }, effort });
      }
      add('high', { thinking: { type: 'enabled', budgetTokens: high } }, `High · ${high.toLocaleString('en-US')} tokens`);
      add('max', { thinking: { type: 'enabled', budgetTokens: maximum } }, `Maximum · ${maximum.toLocaleString('en-US')} tokens`);
    }
  } else for (const effort of reasoning.effort || []) {
    if (effort !== 'default' && effort !== 'none' && /^[a-z][a-z0-9_-]*$/.test(effort)) add(effort, { effort });
  }
  return result;
}

function matchingMetadata(data, input, id) {
  if (!data) return null;
  const route = input.protocol === 'anthropic' ? 'messages' : input.protocol === 'responses' ? 'responses' : 'chat-completions';
  for (const provider of Object.values(data)) {
    const model = provider?.models?.[id];
    if (model?.api?.[route]?.base_url?.replace(/\/$/, '') === input.endpoint) return model;
  }
  // Upstream metadata describes the named model, not a guarantee that a custom
  // gateway implements all its controls. The UI states this distinction.
  return data[input.protocol === 'anthropic' ? 'anthropic' : 'openai']?.models?.[id] || null;
}

export function modelDetail(item, input, known = null) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.id !== 'string' || !item.id || /\s|#/.test(item.id) || ['__proto__','constructor','prototype'].includes(item.id) || item.id.length > 300 || input.key && item.id.includes(input.key)) return null;
  if (item.lifecycle === 'retired' || known?.type && known.type !== 'chat') return null;
  const capability = item.capabilities;
  const anthropic = input.protocol === 'anthropic' && capability?.thinking;
  let reasoning = known?.capabilities?.reasoning || { supported: false };
  if (anthropic) {
    const effort = capability.effort?.supported ? ['low', 'medium', 'high', 'xhigh', 'max'].filter(level => supported(capability.effort[level])) : [];
    reasoning = { supported: anthropic.supported === true || effort.length > 0, ...(effort.length ? { effort } : {}), ...(supported(anthropic.types?.enabled) ? { budget: { min: 1024 } } : {}), toggle: supported(anthropic.types?.disabled) };
  } else if (typeof capability?.reasoning?.supported === 'boolean') reasoning = capability.reasoning;
  const limit = { ...known?.limit, ...(positive(item.max_input_tokens) ? { input: item.max_input_tokens, context: item.max_input_tokens } : {}), ...(positive(item.max_tokens) ? { output: item.max_tokens } : {}) };
  const tools = typeof capability?.tools === 'boolean' ? capability.tools : typeof capability?.tools?.supported === 'boolean' ? capability.tools.supported : known?.capabilities?.tools?.supported;
  const name = item.display_name || item.name || known?.name || item.id;
  return { id: item.id, name: typeof name === 'string' && !(input.key && name.includes(input.key)) ? name.slice(0, 160) : item.id,
    tools: tools ?? null, reasoning, limit, variants: thinkingVariants(input.protocol, reasoning, limit, anthropic?.types),
    metadata_source: capability?.thinking || capability?.reasoning ? 'provider' : known ? 'models.dev' : 'unreported' };
}

const inventoryKey = input => sha256({ endpoint: input.endpoint, protocol: input.protocol, credential: input.key });
export function knownModel(input, id) { return inventories.get(inventoryKey(input))?.find(item => item.id === id); }

export async function discoverProviderModels(raw, fetcher = fetch) {
  const input = providerInput(raw), headers = { accept: 'application/json' };
  if (input.protocol === 'anthropic') {
    headers['anthropic-version'] = anthropicVersion;
    if (input.key) headers['x-api-key'] = input.key;
  } else if (input.key) headers.authorization = `Bearer ${input.key}`;
  const signal = AbortSignal.timeout(25_000), items = [], cursors = new Set();
  const metadataPromise = modelMetadata(fetcher);
  let after;
  do {
    const url = new URL(`${input.endpoint}/models`);
    if (input.protocol === 'anthropic') { url.searchParams.set('limit', '100'); if (after) url.searchParams.set('after_id', after); }
    const response = await fetcher(url.toString(), { headers, signal, redirect: 'error' });
    if (!response.ok) throw Error(`Model discovery returned HTTP ${response.status}. Check the endpoint and credential.`);
    if (!response.headers.get('content-type')?.includes('json')) throw Error('The endpoint returned a web page, not a model catalogue. Check its API base URL.');
    let data;
    try { data = await response.json(); } catch { throw Error('The provider returned an invalid model catalogue.'); }
    if (!Array.isArray(data.data)) throw Error('The provider did not return a supported model catalogue.');
    items.push(...data.data);
    if (items.length > 20_000) throw Error('The model catalogue exceeds the supported discovery size.');
    if (!data.has_more) break;
    after = data.last_id;
    if (typeof after !== 'string' || !after || cursors.has(after)) throw Error('Model catalogue pagination did not advance.');
    cursors.add(after);
  } while (!signal.aborted);
  if (signal.aborted) throw Error('Model discovery timed out; no partial catalogue was published.');
  const published = await metadataPromise, found = new Map();
  for (const item of items) { const detail = modelDetail(item, input, matchingMetadata(published, input, item?.id)); if (detail) found.set(detail.id, detail); }
  const details = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  const id = inventoryKey(input); inventories.delete(id); inventories.set(id, details);
  while (inventories.size > 8) inventories.delete(inventories.keys().next().value);
  return { models: details.map(item => item.id), modelDetails: details, endpoint: input.endpoint, protocol: input.protocol, name: input.name, metadata_available: !!published, discovered: new Date().toISOString() };
}

export function modelConfiguration(model) {
  if (!model) return { capabilities: { tools: true, freeform: [], reasoning: { supported: false } }, variants: [] };
  return { name: model.name, capabilities: { tools: model.tools ?? true, freeform: [], reasoning: { supported: false } },
    ...(Object.keys(model.limit).length ? { limit: model.limit } : {}), variants: model.variants.map(({ id, settings }) => ({ id, settings })) };
}
