/* Synthetic data, mounted only by the isolated staging build. */
(()=>{
 const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Saved worship song',source:{audioBase64:'AAAA',name:'test.mp3',duration:61},analysis:{notes:[{midi:40,start:0,end:1}],chords:[{chord:'C'}]}};
 const files=new Map([
  ['saved-song.bassstudio',JSON.stringify(project)],
  ['BassStem_SongChords_2026-11-08.json',JSON.stringify({format:'BassStemSongReferences',changes:[]})],
  ['BassStem_Praise_Worship_Number_Charts.json',JSON.stringify({format:'BassStemSongChordPack',songs:[]})]
 ]);
 const folder={name:'Mixed audio and chord backups',queryPermission:async()=> 'granted',async *entries(){for(const [name,content]of files)yield [name,{kind:'file',getFile:async()=>new File([content],name,{lastModified:1})}];}};
 const bar=document.createElement('div');bar.style.cssText='position:fixed;top:46px;left:0;z-index:2147483647;background:#14283c;padding:6px';
 const button=document.createElement('button');button.textContent='Check mixed folder';button.onclick=async()=>{await window.BassLibrary.__testFolder(folder);await window.BassLibrary.show();};
 const damaged=document.createElement('button');damaged.textContent='Add damaged test file';damaged.onclick=async()=>{files.set('damaged.json','{invalid');await window.BassLibrary.__testFolder(folder);await window.BassLibrary.show();};
 bar.append(button,damaged);document.body.append(bar);
})();
