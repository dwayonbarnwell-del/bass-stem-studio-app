importScripts('./project-json.js?v=rc364');
const SUPPORTED=/\.(bassstudio|bssproject|json)$/i;
const clean=v=>String(v||'').trim();
  function metadata(p,file){
    if(p?.format!=='Bass Stem Studio Project'||Number(p.schemaVersion??1)!==2||!Array.isArray(p.analysis?.notes)||!p.source?.audioBase64)
      throw Error('This file is not a supported saved Bass Stem project.');
    return {title:clean(p.projectName)||file.name.replace(SUPPORTED,''),artist:clean(p.library?.artist),
      key:clean(p.analysis.scale),bpm:Number(p.analysis.tempoBpm)||null,duration:Number(p.source.duration)||0,
      filename:file.name,size:file.size,modified:file.lastModified||Date.now(),savedAt:clean(p.savedAt),
      sourceName:clean(p.source?.name),sourceSize:Number(p.source?.size)||0,
      hasChordAnalysis:Array.isArray(p.analysis?.chords)&&p.analysis.chords.length>0,
      hasBassAnalysis:Array.isArray(p.analysis?.notes)&&p.analysis.notes.length>0};
  }
  async function audioIdentity(project){
    const bytes=new TextEncoder().encode(project.source.audioBase64);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function indexedMetadata(project,file){
    return {...metadata(project,file),audioId:await audioIdentity(project)};
  }

self.onmessage=async ({data:file})=>{try{const p=await BassProjectJSON.read(file,{playback:true});const meta=(p?.format==='BassStemSongReferences'||p?.format==='BassStemSongChordPack')?{kind:'chord-catalogue',size:file.size,modified:file.lastModified}:await indexedMetadata(p,file);self.postMessage({meta});}catch(e){self.postMessage({error:e.message});}};
