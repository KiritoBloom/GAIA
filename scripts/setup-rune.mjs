import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
const root=resolve(process.cwd());
if(!root.endsWith('GAIA')) throw new Error('Run this setup from the GAIA workspace root.');
const base=resolve(root,'.runtime/rune'),download=resolve(base,'downloads');
for(const path of [base,download,resolve(base,'cargo'),resolve(base,'rustup'),resolve(base,'home'),resolve(root,'.tmp')]) await mkdir(path,{recursive:true});
const env={...process.env,CARGO_HOME:resolve(base,'cargo'),RUSTUP_HOME:resolve(base,'rustup'),CARGO_TARGET_DIR:resolve(base,'target'),HOME:resolve(base,'home'),USERPROFILE:resolve(base,'home'),TEMP:resolve(root,'.tmp'),TMP:resolve(root,'.tmp'),RUSTUP_INIT_SKIP_PATH_CHECK:'yes',RUSTUP_TOOLCHAIN:'stable-x86_64-pc-windows-gnu'};
env.PATH=[resolve(base,'cargo/bin'),resolve(base,'w64devkit/bin'),resolve(root,'.runtime/bin'),process.env.PATH].join(delimiter);
env.LIBRARY_PATH=resolve(base,'rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/lib/self-contained');
env.CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=resolve(base,'w64devkit/bin/gcc.exe');
function run(command,args){const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.error) throw result.error;if(result.status!==0) throw new Error(`${command} exited ${result.status}.`);}
async function exists(path){try{await access(path);return true;}catch{return false;}}
async function get(url,file,hash){if(await exists(file)){if(createHash('sha256').update(await readFile(file)).digest('hex')!==hash) throw new Error('Cached tool checksum mismatch; refused to run.');return;}const response=await fetch(url);if(!response.ok) throw new Error(`Download failed: ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==hash) throw new Error('Downloaded tool checksum mismatch; refused to run.');await writeFile(file,bytes);}
const compiler=resolve(download,'w64devkit.7z.exe');
await get('https://github.com/skeeto/w64devkit/releases/download/v2.11.0/w64devkit-x64-2.11.0.7z.exe',compiler,'54c2bb9962e8a30c8270e34c5efc3d5fee579f53087fa7d435b95fbba2af7b2b');
if(!await exists(resolve(base,'w64devkit/bin/gcc.exe'))) run(compiler,['-y',`-o${base}`]);
const installer=resolve(download,'rustup-init.exe'),url='https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-gnu/rustup-init.exe';
const checksum=(await (await fetch(`${url}.sha256`)).text()).trim().split(/\s+/)[0];
await get(url,installer,checksum);
if(!await exists(resolve(base,'cargo/bin/rustup.exe'))) run(installer,['-y','--no-modify-path','--profile','minimal','--default-host','x86_64-pc-windows-gnu','--default-toolchain','stable','--target','wasm32-unknown-unknown']);
const archive=resolve(download,'wasm-bindgen.tar.gz');
await get('https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.129/wasm-bindgen-0.2.129-x86_64-pc-windows-msvc.tar.gz',archive,'79e348c169d0c10c0b287647f1e753d0985353ca96800bc29be8f4261baf13e6');
if(!await exists(resolve(base,'wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'))) run('tar',['-xzf',archive,'-C',base]);
const vendor=resolve(root,'.runtime/vendor/rune'),rev='165f87a4700a5515b03d4de04876aa2e64a30c21';
if(!await exists(resolve(vendor,'.git'))) {await mkdir(resolve(root,'.runtime/vendor'),{recursive:true});run('git',['clone','--depth','1','--branch','dev','https://github.com/anomalyco/rune.git',vendor]);run('git',['-C',vendor,'fetch','--depth','1','origin',rev]);run('git',['-C',vendor,'checkout','--detach',rev]);}
run(resolve(base,'cargo/bin/cargo.exe'),['build','--manifest-path',resolve(vendor,'Cargo.toml'),'-p','web-hello','--target','wasm32-unknown-unknown','--release','--lib']);
run(resolve(base,'wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'),['--target','web','--out-dir',resolve(root,'.runtime/rune/proof'),'--out-name','rune-proof',resolve(base,'target/wasm32-unknown-unknown/release/web_hello.wasm')]);
console.log('Rune web example compiled with project-local Rust, GNU tools and WASM output. This verifies the framework build, not GAIA migration completion.');
