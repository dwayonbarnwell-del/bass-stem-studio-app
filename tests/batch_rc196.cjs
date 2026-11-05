const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
const {File}=require('node:buffer');
const src=fs.readFileSync(__dirname+'/../batch-source/batch.js','utf8');
const main=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(main.includes(src.trim()),'Batch source must be inlined in the offline app');
assert(main.includes('window.BassBatch.init('),'Batch must use existing app callbacks');
assert(main.includes('saveBassStudioProject({batchName:name})'),'Batch must use real saved-project routine');
const c={window:{BassLibrary:{},BassDialog:{}},File,Blob,Response,DecompressionStream,TextDecoder,DataView,Set,Map,Error,Number,String,JSON,Uint8Array};
vm.createContext(c);
const testSrc=src.replace('return {init,show,isRunning:()=>working,listZip};',
  'return {init,show,isRunning:()=>working,listZip,getSong,chooseZip:f=>{archive=f;}};');
assert.notEqual(testSrc,src);
vm.runInContext(testSrc,c);
const batch=c.window.BassBatch;
const enc=new TextEncoder();
function zipFiles(files){
  const local=[],central=[];let offset=0;
  for(const {name,body,method=8} of files){
    const raw=Buffer.from(body),packed=method===8?deflateRawSync(raw):raw,filename=Buffer.from(name);
    const lf=Buffer.alloc(30);lf.writeUInt32LE(0x04034b50,0);lf.writeUInt16LE(method,8);
    lf.writeUInt32LE(packed.length,18);lf.writeUInt32LE(raw.length,22);lf.writeUInt16LE(filename.length,26);
    local.push(lf,filename,packed);
    const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(method,10);
    cd.writeUInt32LE(packed.length,20);cd.writeUInt32LE(raw.length,24);
    cd.writeUInt16LE(filename.length,28);cd.writeUInt32LE(offset,42);
    central.push(cd,filename);offset+=lf.length+filename.length+packed.length;
  }
  const entries=files.length,centralDir=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries,8);end.writeUInt16LE(entries,10);
  end.writeUInt32LE(centralDir.length,12);end.writeUInt32LE(offset,16);
  return new File([...local,centralDir,end],'sample.zip',{type:'application/zip'});
}
(async()=>{
 const zip=zipFiles([
   {name:'Ada Ehi - Cheta.mp3',body:'sample MP3 payload 1'},
   {name:'nested/Above All.mp3',body:'sample MP3 payload 2',method:0},
   {name:'readme.txt',body:'ignored text'}
 ]);
 const songs=await batch.listZip(zip);
 assert.equal(songs.length,2);
 assert.equal(songs[0].title,'Ada Ehi - Cheta');
 assert.equal(songs[1].title,'Above All');
 batch.chooseZip(zip);
 const a=await batch.getSong(songs[0]),b=await batch.getSong(songs[1]);
 assert.equal(await a.text(),'sample MP3 payload 1');
 assert.equal(await b.text(),'sample MP3 payload 2');
 assert.equal(a.name,'Ada Ehi - Cheta.mp3');
 assert.equal(b.name,'Above All.mp3');
 const repeats=await batch.listZip(zipFiles([
   {name:'first/Song.mp3',body:'a'},
   {name:'second/Song.wav',body:'b'}
 ]));
 assert.equal(repeats[1].status,'Skipped','Duplicate song titles must not overwrite silently');
 await assert.rejects(()=>batch.listZip(new File(['not a zip'],'bad.zip')),/ZIP directory/);
 await assert.rejects(()=>batch.listZip(new File(['text'],'bad.txt')),/Choose a ZIP/);
 console.log('PASS: batch ZIP central directory; stored and deflated media; nested files; duplicates; damaged ZIP; unchanged analysis/save hooks.');
})().catch(e=>{console.error(e);process.exitCode=1;});