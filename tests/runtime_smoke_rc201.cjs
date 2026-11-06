// RC201 read-only browser boot diagnostic. No RunPod inference is submitted.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const pre='<script>window.__smokeErrors=[];window.addEventListener("error",e=>window.__smokeErrors.push(String(e.message||e.target?.src||"resource error")));window.addEventListener("unhandledrejection",e=>window.__smokeErrors.push(String(e.reason||"rejected")));</script>';
function makeDiagnosticZip(){
 const name=Buffer.from('Diagnostic-song.mp3'),data=Buffer.from('test-audio-placeholder');
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+data.length,16);
 return Buffer.concat([local,name,data,central,name,end]).toString('base64');
}
const fixture64=makeDiagnosticZip();
const tail=[
'<script>',
'setTimeout(async function(){',
"const result={loaded:!!document.querySelector('#appRoot'),batch:!!window.BassBatch,library:!!window.BassLibrary,errors:window.__smokeErrors.slice(0,12)};",
'try{',
'window.BassBatch.show();',
"const raw=Uint8Array.from(atob('"+fixture64+"'),c=>c.charCodeAt(0));const file=new File([raw],'diagnostic.zip',{type:'application/zip'});const input=document.getElementById('batchFile');const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,1700));result.archiveMessage=document.getElementById('batchArchive')?.textContent;result.songCount=document.getElementById('batchCount')?.textContent;",
"const d=document.querySelector('#bassBatchDialog');",
'result.dialog=!!d?.open;',
"result.startDisabled=document.querySelector('#batchStart')?.disabled;",
"const cells=['batchCheck','batchStart','batchStop','batchClose'].map(id=>document.getElementById(id));",
'result.controlsPresent=cells.every(Boolean);',
'result.buttonWidths=cells.map(el=>Math.round(el.getBoundingClientRect().width));',
"result.fileButton=!!document.querySelector('#batchPick');",
"result.mode=window.getComputedStyle(document.querySelector('.batch-actions')).gridTemplateColumns;",
'}catch(e){result.error=String(e.stack||e)}',
"const marker=document.createElement('output');marker.id='smoke-result';marker.textContent=JSON.stringify(result);document.body.appendChild(marker);",
'},2500);',
'</script>'
].join('\n');
let html=source.replace('<head>','<head>'+pre);
assert.notEqual(html,source,'Head marker missing');
html=html.replace('</body>',tail+'</body>');
assert(html.includes('smoke-result'),'Diagnostic injection missing');
const server=http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||'/').split('?')[0]);
 if(url==='/'||url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}
 if(url.includes('..')){res.writeHead(403);res.end();return;}
 const file=path.join(__dirname,'..',url.slice(1));
 try{
  const data=fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'application/octet-stream'});
  res.end(data);
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1',()=>{
 const port=server.address().port, tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bass-runtime-'));
 const browsers=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(fs.existsSync);
 if(!browsers.length){console.error('No Chrome/Chromium installed on runner');process.exitCode=1;server.close();return;}
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-extensions','--disable-background-networking','--disable-default-apps','--no-default-browser-check','--user-data-dir='+tmp,'--virtual-time-budget=9500',
 '--host-resolver-rules=MAP api.runpod.ai 0.0.0.0, MAP *.runpod.io 0.0.0.0','--dump-dom','http://127.0.0.1:'+port+'/index.html'];
 const proc=cp.spawn(browsers[0],args);
 let stdout='',stderr='',timedout=false;
 const timeout=setTimeout(()=>{timedout=true;proc.kill('SIGKILL');},45000);
 proc.stdout.on('data',b=>stdout+=b);
 proc.stderr.on('data',b=>stderr+=b);
 proc.on('close',(status)=>{
  clearTimeout(timeout);
  const match=stdout.match(/<output id="smoke-result">([\s\S]*?)<\/output>/);
  console.log('Chrome exit:',status,'timedout:',timedout,'stderr tail:',stderr.slice(-800));
  if(match){
    const decoded=match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    try{
      const data=JSON.parse(decoded);
      console.log('BOOT DIAGNOSTIC:',JSON.stringify(data));
      assert(data.loaded&&data.batch&&data.library&&data.dialog&&data.controlsPresent,'App or batch dialog failed');
      assert(Math.max(...data.buttonWidths)-Math.min(...data.buttonWidths)<=2,'Batch controls have unequal widths');
      assert(data.startDisabled===false,'Start batch remained disabled after valid ZIP import: '+data.archiveMessage);
      assert((data.archiveMessage||'').includes('songs found'),'ZIP song list did not load: '+data.archiveMessage);
      if(data.errors.length)console.log('Browser JS errors:',JSON.stringify(data.errors));
    }catch(e){console.error('Smoke assertion:',e.stack||e);process.exitCode=1;}
  }else{console.error('No diagnostic output. Browser DOM tail:',stdout.slice(-1300));process.exitCode=1;}
  server.close(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 });
});
