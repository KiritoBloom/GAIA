import { resolve, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync } from 'node:fs';
const root=resolve(process.cwd()),base=resolve(root,'.runtime/rune');
const env={...process.env,CARGO_HOME:resolve(base,'cargo'),RUSTUP_HOME:resolve(base,'rustup'),CARGO_TARGET_DIR:resolve(base,'target'),RUSTUP_TOOLCHAIN:'stable-x86_64-pc-windows-gnu',HOME:resolve(base,'home'),USERPROFILE:resolve(base,'home'),TEMP:resolve(root,'.tmp'),TMP:resolve(root,'.tmp'),LIBRARY_PATH:resolve(base,'rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/lib/self-contained'),CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER:resolve(base,'w64devkit/bin/gcc.exe')};
env.PATH=[resolve(base,'cargo/bin'),resolve(base,'w64devkit/bin'),resolve(root,'.runtime/bin'),process.env.PATH].join(delimiter);
function run(exe,args){const log=resolve(base,'build.log'),fd=openSync(log,'w');let result;try{result=spawnSync(exe,args,{cwd:root,env,stdio:['ignore',fd,fd],windowsHide:true});}finally{closeSync(fd);}if(result.error)throw result.error;if(result.status!==0){console.error(readFileSync(log,'utf8').slice(-6000));process.exit(result.status);}console.log('Completed local Rune build stage. Framework warnings are recorded in .runtime/rune/build.log.');}
run(resolve(base,'cargo/bin/cargo.exe'),['build','--manifest-path',resolve(root,'app/rune/Cargo.toml'),'--target','wasm32-unknown-unknown','--release','--lib']);
run(resolve(base,'wasm-bindgen-0.2.129-x86_64-pc-windows-msvc/wasm-bindgen.exe'),['--target','web','--out-dir',resolve(base,'gaia'),'--out-name','gaia',resolve(base,'target/wasm32-unknown-unknown/release/gaia_rune.wasm')]);
console.log('GAIA Rune WASM bundle built. Browser rendering and interaction must still be verified.');
