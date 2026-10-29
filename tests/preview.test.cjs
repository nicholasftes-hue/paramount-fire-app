const {test}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),fs=require('node:fs'),vm=require('node:vm');
test('unhosted fictional preview parses, preserves print templates and contains no production cloud target',()=>{
 execFileSync('python3',['scripts/prepare-fictional-preview.py'],{stdio:'inherit'});const html=fs.readFileSync('test-results/fictional-preview/index-3.html','utf8');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
 assert.equal((html.match(/FICTIONAL DATA PREVIEW/g)||[]).length,1);assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src 'none'/);assert.match(html,/CLOUD_KEY='FICTIONAL-NO-CREDENTIAL'/);assert.doesNotMatch(html,/https:\/\/[^'"\s]+\.supabase\.co/);assert.match(html,/paramount-fictional-preview-v1/);assert.doesNotMatch(fs.readFileSync('test-results/fictional-preview/main-app.js','utf8'),/paramount-main-app-v1:/);assert(fs.existsSync('test-results/fictional-preview/templates/Paramount_Quotation_Editable.docx'));
});
