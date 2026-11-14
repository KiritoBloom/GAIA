import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { portableNode } from './portable-node.mjs';
const root=resolve(process.cwd());
for(const script of ['setup.mjs','setup-rune.mjs','build-rune.mjs']){
 const node=await portableNode(root),result=spawnSync(node,[`scripts/${script}`],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status);
}
