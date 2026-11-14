import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(process.cwd());
export function isolateEnvironment() {
  // Set before dynamic SDK imports. No user/global harness config is modified.
  const homes = { XDG_CONFIG_HOME: '.runtime/config', XDG_DATA_HOME: '.runtime/data', XDG_CACHE_HOME: '.runtime/cache', XDG_STATE_HOME: '.runtime/state', HOME: '.runtime/home', USERPROFILE: '.runtime/home', APPDATA: '.runtime/appdata', LOCALAPPDATA: '.runtime/localappdata', TEMP: '.tmp', TMP: '.tmp', TMPDIR: '.tmp', BUN_INSTALL_CACHE_DIR: '.cache/bun', npm_config_cache: '.cache/npm', PIP_CACHE_DIR: '.cache/pip', PYTHONPYCACHEPREFIX: '.cache/pycache' };
  for (const [key, relative] of Object.entries(homes)) {
    process.env[key] = resolve(ROOT, relative);
    mkdirSync(process.env[key], { recursive: true });
  }
  process.env.OPENCODE_DISABLE_FREE_MODELS = '1';
  process.env.PYTHONNOUSERSITE = '1';
}
