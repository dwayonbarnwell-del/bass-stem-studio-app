// Injected only by the isolated staging build, within the app closure.
const sessionAudit=document.createElement('aside');
sessionAudit.innerHTML='<button id="sessionAuditLoad" style="position:fixed;top:48px;left:8px;z-index:999999">Load refresh test songs</button><output id="sessionAuditResult" style="position:fixed;top:88px;left:8px;z-index:999999;background:white;color:#111;padding:8px;max-width:90%;white-space:pre-wrap"></output>';
document.body.append(sessionAudit);
document.getElementById('sessionAuditLoad').onclick=async()=>{
 const out=document.getElementById('sessionAuditResult');out.textContent='Preparing test songs';
 try{
  ensureCtx();const b=ctx.createBuffer(1,11025*12,11025),data=b.getChannelData(0),triads=[[0,4,7],[5,9,12],[7,11,14],[9,12,16]];
  for(let i=0;i<data.length;i++)for(const n of triads[Math.min(3,Math.floor(i/11025/3))])data[i]+=.18*Math.sin(2*Math.PI*261.626*2**(n/12)*i/11025);
  const blob=wavBlob(b),oldFile=new File([blob],'Earlier test song.wav',{type:'audio/wav',lastModified:1}),newFile=new File([blob],'Last opened song.wav',{type:'audio/wav',lastModified:2});
  if(!await loadAudioFile(oldFile,{batchImport:true}))throw Error('First import failed');
  if(!await loadAudioFile(newFile,{batchImport:true}))throw Error('Last import failed');
  detectedChordChanges=[{start:3,end:6,rootPc:5,quality:'maj',manual:true,confidence:1,source:'User correction'}];
  await persistAnalysisRecovery(true);
  await recoveryStore(RUNPOD_RECOVERY_STORE,s=>s.put({signature:cloudFileSignature(oldFile),name:oldFile.name,type:oldFile.type,lastModified:1,blob:oldFile,cachedAt:Date.now()+100000}));
  window.BassChordRecovery.queue();
  for(let i=0;i<120&&!detectedChordChanges.some(c=>c.evidenceVersion==='local-chord-v1');i++)await new Promise(r=>setTimeout(r,100));
  if(!detectedChordChanges.some(c=>c.evidenceVersion==='local-chord-v1'))throw Error('Automatic chords missing');
  if(!detectedChordChanges.some(c=>c.manual&&c.start===3&&c.end===6))throw Error('Manual correction lost');
  if(document.getElementById('sourceFileDetails').textContent!=='0:12')throw Error('Duration display incorrect');
  out.textContent='PASS: automatic chords and manual correction retained. Refresh to test the last song.';
 }catch(e){out.textContent='FAIL: '+e.message;}
};
if(readLastOpenedSession()?.name==='Last opened song.wav'){
 const verifyRefresh=setInterval(()=>{
  if(!buffer||songImportBusy||pendingResumeBusy)return;
  clearInterval(verifyRefresh);
  document.getElementById('sessionAuditResult').textContent=activeAudioFile?.name==='Last opened song.wav'&&detectedChordChanges.some(c=>c.manual)?'PASS: refresh restored the last song and its saved chords.':'FAIL: refresh restored the wrong song or lost saved chords.';
 },200);
 setTimeout(()=>clearInterval(verifyRefresh),15000);
}
