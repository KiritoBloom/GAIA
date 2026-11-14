import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
if(existsSync('.env'))process.loadEnvFile('.env');
const files=execFileSync('git',['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean);
const secrets=Object.entries(process.env).filter(([name,value])=>/KEY|TOKEN|SECRET|PASSWORD/i.test(name)&&value&&value.length>=8).map(([,value])=>value);
for(const file of files){
  if(file==='.env'||file==='plan.md'||file.startsWith('.runtime/')||file.startsWith('.venv/'))throw new Error(`Private path staged: ${file}`);
  if(/\.(png|pdf|woff2)$/i.test(file))continue;
  const content=execFileSync('git',['show',`:${file}`],{maxBuffer:20*1024*1024}).toString();
  if(secrets.some(secret=>content.includes(secret)))throw new Error(`Credential value detected in staged file: ${file}`);
  if(/ses_[A-Za-z0-9]{20,}/.test(content))throw new Error(`Private runtime session identifier detected: ${file}`);
}
console.log(`Checked ${files.length} staged files: no private credential values, runtime paths or literal runtime session IDs detected. Binary images/PDFs require separate provenance/privacy review.`);
