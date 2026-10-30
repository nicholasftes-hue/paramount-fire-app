// Real updated ClamAV engine required; never contacts customers or publishes.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {quarantine}=require('../server/scan-template.cjs');
(async()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paramount-av-'));try{
 assert.equal((await quarantine('templates/Paramount_Invoice_Fillable.pdf',directory)).verdict,'clean');
 const file=path.join(directory,'eicar.pdf');
 // Standard harmless antivirus test string, assembled so repository scanning stays usable.
 fs.writeFileSync(file,['X5O!P%@AP[4',String.fromCharCode(92),'PZX54(P^)7CC)7}$','EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join(''));
 const blocked=await quarantine(file,directory,{inspect:async()=>({format:'pdf',fields:[]})});
 assert.equal(blocked.verdict,'blocked');
 console.log('PASS real updated antivirus: benign PDF clean, EICAR quarantined; no publication');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(()=>{console.error('FAIL real antivirus acceptance');process.exitCode=1;});
