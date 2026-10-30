'use strict';
// Local quarantine only. No endpoint, publishing credential or production configuration.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspector(){const context={window:{},document:{addEventListener(){}},TextEncoder,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,crypto:crypto.webcrypto,btoa,atob,URL,setTimeout};vm.createContext(context);for(const f of ['imported-pdf.js','document-templates.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);return context.window.ParamountTemplates.inspect;}
async function clamScan(file){const {stdout}=await run('clamscan',['--version'],{timeout:10000,maxBuffer:4096});const updated=Date.parse(stdout.trim().split('/').at(-1));if(!Number.isFinite(updated)||Date.now()-updated>48*3600000||updated>Date.now()+300000)throw Error('Antivirus signatures unavailable or stale');await run('clamscan',['--no-summary','--',file],{timeout:60000,maxBuffer:4096});}
async function quarantine(input,directory,{scan=clamScan,inspect=inspector()}={}){
 const stat=fs.lstatSync(input);if(!stat.isFile()||stat.size<1||stat.size>2097152)throw Error('Use a regular non-empty file up to 2 MB.');
 const fd=fs.openSync(input,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes;try{bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}if(bytes.length!==stat.size)throw Error('Input changed. Retry.');const sha256=hash(bytes),ext=path.extname(input).toLowerCase();if(!['.pdf','.docx'].includes(ext))throw Error('Unsupported template format.');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const dir=fs.mkdtempSync(path.join(directory,'pending-'));fs.chmodSync(dir,0o700);const original=path.join(dir,'original'+ext);fs.writeFileSync(original,bytes,{mode:0o600,flag:'wx'});
 let verdict='blocked',info=null;
 try{info=await inspect('original'+ext,Uint8Array.from(bytes).buffer);await scan(original);if(hash(fs.readFileSync(original))!==sha256)throw Error('Quarantined bytes changed.');verdict='clean';}
 catch{/* Missing scanner, timeout, infection, malformed content and scanner errors all block publication. */}
 const report={version:1,sha256,size:bytes.length,format:ext.slice(1),verdict,checked:new Date().toISOString(),structuralInspection:!!info,fields:verdict==='clean'?info.fields:null};fs.writeFileSync(path.join(dir,'scan.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});return report;
}
module.exports={quarantine};
if(require.main===module){const [flag,input,directory,...rest]=process.argv.slice(2);if(flag!=='--isolated'||!input||!directory||rest.length){console.error('Usage: node server/scan-template.cjs --isolated INPUT PRIVATE_QUARANTINE_DIRECTORY');process.exitCode=2;}else quarantine(input,directory).then(r=>{console.log(JSON.stringify(r));if(r.verdict!=='clean')process.exitCode=1;}).catch(()=>{console.error('Template quarantine rejected input.');process.exitCode=1;});}
