import { createHash } from 'node:crypto';

export const ROLES = ['gaia', 'aura', 'thalassa', 'chloris', 'zoe'];
export function validRole(role) { return ROLES.includes(role); }
export function safeEndpoint(raw) {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash) throw new Error('Provider endpoint must not contain credentials, query parameters or a fragment.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Use HTTPS for remote providers; HTTP is allowed only for a local model server.');
  return url.toString().replace(/\/$/, '');
}
export function safeRequest(request) {
  const host = request.headers.host;
  if (!['127.0.0.1:4317', 'localhost:4317'].includes(host)) return false;
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  if (request.headers['x-gaia-client'] !== '1') return false;
  const origin = request.headers.origin;
  return !origin || ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4317', 'http://localhost:4317'].includes(origin);
}
export function sha256(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function publicError(error) {
  let text=String(error?.message || 'Operation failed.');
  for(const [name,value] of Object.entries(process.env)) if(/KEY|TOKEN|SECRET|PASSWORD/i.test(name) && value && value.length>=6) text=text.split(value).join('[redacted]');
  if(/https?:\/\/|Bearer\s|authorization|api.?key|[A-Z]:\\/i.test(text)) return 'Provider or service operation failed; no credentials or unverified result published.';
  return text;
}
export function validateNumberClaims(claims, artifact) {
  const permitted = artifact?.analysis;
  if (!Array.isArray(claims)) throw new Error('Invalid numerical claim list.');
  for (const claim of claims) {
    if (!['slope_per_year', 'slope_per_decade', 'p_value', 'n', 'missing'].includes(claim.field) || !permitted || permitted[claim.field] !== claim.value) throw new Error('Unbacked numerical claim rejected.');
  }
  return true;
}
