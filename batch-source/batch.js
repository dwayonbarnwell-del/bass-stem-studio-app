/* RC196: sequential ZIP-to-library processing. Uses the app's own import, RunPod analysis and project save. */
window.BassBatch = (() => {
  const audio = new Set(['mp3','wav','wave','m4a','m4b','aac','aif','aiff','aifc','caf','flac','ogg','oga','opus','wma']);
  const video = new Set(['mp4','m4v','mov','webm','mkv','avi','mpeg','mpg','3gp','3g2','ogv','wmv']);
  const MAX_ZIP = 600 * 1048576, MAX_ENTRY = 200 * 1048576, MAX_TOTAL = 1600 * 1048576, MAX_SONGS = 150;
  let hooks = {}, dialog, archive, entries = [], working = false, stopAfterCurrent = false, completed = new Set(), storageKey = '';
  const $ = id => document.getElementById(id);
  const number = (v, offset, size) => size === 2 ? v.getUint16(offset, true) : v.getUint32(offset, true);
  const ext = name => String(name).split('.').pop().toLowerCase();
  const clean = name => String(name).replace(/\\/g,'/').split('/').pop().replace(/\.[^.]+$/,'').trim();
  const projectTitle = name => clean(name).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').slice(0,95) || 'Untitled song';
  const errorMessage = err => String(err && err.message || err || 'Unknown error');
  const rowStatus = item => item.status || 'Queued';
  function tell(message) { if ($('batchStatus')) $('batchStatus').textContent = message; }
  function draw() {
    if (!dialog) return;
    $('batchCount').textContent = entries.length ? entries.length + ' songs · ' + entries.filter(i => i.status === 'Saved').length + ' saved' : 'Choose a ZIP of audio or video files';
    $('batchStart').disabled = working || !archive || !entries.some(i => i.status !== 'Saved' && i.status !== 'Skipped');
    $('batchStart').textContent = entries.some(i => i.status === 'Error') ? 'Retry remaining' : 'Start batch';
    $('batchStop').disabled = !working;
    $('batchFile').disabled = working;
    $('batchClose').disabled = working;
    const list = $('batchSongs'); list.replaceChildren();
    entries.forEach((item, index) => {
      const line = document.createElement('li');
      const title = document.createElement('span'), state = document.createElement('strong');
      title.textContent = (index + 1) + '. ' + item.name;
      state.textContent = rowStatus(item);
      line.append(title, state); list.append(line);
    });
  }
  async function listZip(file) {
    if (!file || !/\.zip$/i.test(file.name)) throw Error('Choose a ZIP file.');
    if (file.size > MAX_ZIP) throw Error('This ZIP is over 600 MB. Use smaller batches.');
    const end = Math.max(0, file.size - 65557);
    const tail = new Uint8Array(await file.slice(end).arrayBuffer());
    const view = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (number(view,i,4) === 0x06054b50 && i + 22 + number(view,i+20,2) === tail.length) { eocd = i; break; }
    }
    if (eocd < 0) throw Error('The ZIP directory could not be found.');
    if (number(view,eocd+4,2) || number(view,eocd+6,2)) throw Error('Multi-volume ZIP files are not supported.');
    const count = number(view,eocd+10,2), length = number(view,eocd+12,4), offset = number(view,eocd+16,4);
    if (count === 65535 || length === 0xffffffff || offset === 0xffffffff) throw Error('ZIP64 archives are not supported. Make smaller ZIP files.');
    if (offset + length > file.size || count > 5000) throw Error('This ZIP has an invalid or oversized directory.');
    const dir = new Uint8Array(await file.slice(offset,offset+length).arrayBuffer());
    const dv = new DataView(dir.buffer), decoder = new TextDecoder('utf-8');
    let at = 0, total = 0; const found = [];
    for (let i=0; i<count; i++) {
      if (at + 46 > dir.length || number(dv,at,4) !== 0x02014b50) throw Error('The ZIP directory is damaged.');
      const flags = number(dv,at+8,2), method = number(dv,at+10,2);
      const compressed = number(dv,at+20,4), size = number(dv,at+24,4), crc = number(dv,at+16,4);
      const nameLength = number(dv,at+28,2), extraLength = number(dv,at+30,2), noteLength = number(dv,at+32,2), localOffset = number(dv,at+42,4);
      const next = at + 46 + nameLength + extraLength + noteLength;
      if (next > dir.length) throw Error('A ZIP entry is incomplete.');
      const name = decoder.decode(dir.slice(at+46,at+46+nameLength)); at = next;
      const kind = ext(name);
      if (name.endsWith('/') || (!audio.has(kind) && !video.has(kind))) continue;
      if (flags & 1) throw Error('Password-protected songs are not supported.');
      if (method !== 0 && method !== 8) throw Error('Unsupported ZIP compression for ' + name);
      if (size === 0 || size > MAX_ENTRY || compressed > MAX_ENTRY || localOffset === 0xffffffff) throw Error('An audio/video file is too large or invalid: ' + name);
      total += size;
      if (total > MAX_TOTAL || found.length >= MAX_SONGS) throw Error('Use smaller ZIP batches (maximum 150 songs and 1.6 GB extracted).');
      found.push({name, size, compressed, method, localOffset, crc, status:'Queued', title:projectTitle(name)});
    }
    if (!found.length) throw Error('No supported audio or video files were found in this ZIP.');
    const used = new Map();
    for (const item of found) {
      const key = item.title.toLocaleLowerCase();
      if (used.has(key)) item.status = 'Skipped', item.reason = 'Duplicate proposed project title in this ZIP';
      else used.set(key,true);
    }
    return found;
  }
  async function getSong(item) {
    const buf = await archive.slice(item.localOffset, item.localOffset+30).arrayBuffer();
    if (buf.byteLength !== 30) throw Error('Incomplete ZIP entry.');
    const h = new DataView(buf);
    if (number(h,0,4) !== 0x04034b50) throw Error('Invalid song header.');
    const offset = item.localOffset + 30 + number(h,26,2) + number(h,28,2);
    if (offset + item.compressed > archive.size) throw Error('Song exceeds the ZIP boundary.');
    const payload = archive.slice(offset,offset+item.compressed);
    let blob;
    if (item.method === 0) blob = payload;
    else {
      if (typeof DecompressionStream !== 'function') throw Error('This browser cannot open compressed ZIP files.');
      blob = await new Response(payload.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    }
    if (blob.size !== item.size) throw Error('The extracted song is incomplete.');
    const name = item.name.split('/').pop().split('\\').pop();
    const type = audio.has(ext(name)) ? (ext(name)==='mp3'?'audio/mpeg':'audio/'+ext(name)) : 'video/'+ext(name);
    return new File([blob],name,{type,lastModified:archive.lastModified});
  }
  async function choose(file) {
    if (working) return;
    archive = null; entries = []; draw();
    tell('Checking ZIP files…');
    try {
      const found = await listZip(file);
      storageKey = 'bass-batch-v1|' + [file.name,file.size,file.lastModified].join('|');
      try { completed = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { completed = new Set(); }
      archive = file; entries = found;
      for (const item of entries) {
        try {
          if (await window.BassLibrary.hasProject(item.title)) {
            item.status = 'Saved'; completed.add(item.name+'|'+item.size+'|'+item.crc);
          }
        } catch (err) { throw Error('Library folder is unavailable: ' + errorMessage(err)); }
      }
      draw(); tell('Ready. Check the list, then start. Songs already in your library will be skipped.');
    } catch(err) { archive=null; entries=[]; draw(); tell(errorMessage(err)); }
  }
  async function run() {
    if (working || !archive) return;
    if (hooks.isBusy && hooks.isBusy()) { tell('Finish the current song first.'); return; }
    if (hooks.hasPending && hooks.hasPending()) { tell('An earlier analysis may still be charged or awaiting a result. Open that song and resolve it before starting a new batch.'); return; }
    const remaining = entries.filter(i=>i.status!=='Saved'&&i.status!=='Skipped');
    if (!remaining.length) { tell('All songs are already saved or skipped.'); return; }
    const approved = await window.BassDialog.confirm(
      'Analyse up to ' + remaining.length + ' songs using your current RunPod service? Bass and section jobs may incur charges. Only one song runs at a time. Do not close this tab while processing.',
      {title:'Confirm batch analysis',accept:'Start analyses'}
    );
    if (!approved) return;
    working=true; stopAfterCurrent=false; draw();
    for (const item of entries) {
      if (stopAfterCurrent) break;
      if (item.status==='Saved'||item.status==='Skipped') continue;
      item.status='Opening'; draw(); tell('Opening: ' + item.name);
      try {
        if (await window.BassLibrary.hasProject(item.title)) { item.status='Saved'; continue; }
        if (hooks.hasPending && hooks.hasPending()) throw Error('An unresolved RunPod job exists. Review it before retrying.');
        const file = await getSong(item);
        if (!await hooks.load(file)) throw Error('This song could not be imported.');
        item.status='Analysing'; draw(); tell('Analysing ' + item.name + ' with the platform’s existing engine…');
        const result = await hooks.analyse();
        if (!result || !result.count || !result.partCount || !result.bassStemReady) {
          throw Error('Complete bass analysis and stems were not confirmed. No incomplete project was saved.');
        }
        item.status='Saving'; draw(); tell('Saving: ' + item.name);
        const saved = await hooks.save(item.title);
        if (!saved || !saved.noteCount) throw Error('Project save was not confirmed.');
        item.status='Saved';
        completed.add(item.name+'|'+item.size+'|'+item.crc);
        try { localStorage.setItem(storageKey,JSON.stringify([...completed])); } catch {}
        draw();
      } catch(err) {
        item.status='Error'; item.reason=errorMessage(err); draw();
        tell('Stopped at ' + item.name + ': ' + item.reason + ' Check any pending RunPod jobs before retrying.');
        stopAfterCurrent=true;
      }
    }
    const finished=entries.filter(i=>i.status==='Saved').length;
    working=false;draw();
    if (!entries.some(i=>i.status==='Error')) tell(stopAfterCurrent?'Stopped after the current song. '+finished+' saved.':'Batch finished. '+finished+' saved in your library.');
  }
  function build() {
    if (dialog) return;
    const css = document.createElement('style');
    css.textContent='#bassBatchDialog{max-width:min(740px,96vw);max-height:88vh;width:96vw;padding:20px;border-radius:12px;font:600 14px/1.5 system-ui,sans-serif;color:inherit;background:#152334;border:1px solid #61778a}#bassBatchDialog h2{font-size:18px;margin:0 0 10px;color:#fff}#bassBatchDialog p,#bassBatchDialog small{color:#e0e9f2}#bassBatchDialog button,#bassBatchDialog input{font:600 14px system-ui,sans-serif}#bassBatchDialog button{padding:10px;border-radius:8px;margin:4px;color:#fff;background:#245477;border:1px solid #5c889e}#bassBatchDialog button:disabled{opacity:.45}#batchSongs{margin:10px 0;padding:0;max-height:42vh;overflow:auto;list-style:none}#batchSongs li{display:flex;gap:12px;justify-content:space-between;border-bottom:1px solid #576678;padding:7px 0;color:#fff}#batchSongs span{overflow-wrap:anywhere}#batchSongs strong{flex:0 0 auto;color:#e6e6e6}';
    document.head.appendChild(css);
    dialog = document.createElement('dialog');
    dialog.id='bassBatchDialog';
    dialog.innerHTML='<h2>Batch ZIP analysis</h2><p>Uses the same bass, chord, section and stem analysis as a single song. Saves only complete projects. Choose a local library folder first for reliable storage.</p><label for="batchFile">Audio or video ZIP</label> <input id="batchFile" type="file" accept=".zip,application/zip"><p id="batchCount" aria-live="polite"></p><ul id="batchSongs"></ul><p id="batchStatus" role="status" aria-live="polite"></p><div><button id="batchStart" type="button">Start batch</button><button id="batchStop" type="button" disabled>Stop after current song</button><button id="batchClose" type="button">Close</button></div>';
    document.body.appendChild(dialog);
    $('batchFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f) void choose(f);};
    $('batchStart').onclick=()=>void run();
    $('batchStop').onclick=()=>{stopAfterCurrent=true;tell('Stopping after the current song is analysed and saved…');};
    $('batchClose').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',e=>{if(working){e.preventDefault();stopAfterCurrent=true;tell('Stopping after the current song…');}});
    draw();
  }
  function init(callbacks) {hooks=callbacks;}
  function show() {build(); if (!dialog.open) dialog.showModal(); draw();}
  return {init,show,isRunning:()=>working,listZip};
})();