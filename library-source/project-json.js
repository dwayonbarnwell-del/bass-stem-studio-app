/* Read large portable projects without allocating a second full copy of all their audio. */
globalThis.BassProjectJSON=(()=>{
  const abort=()=>new DOMException('Cancelled','AbortError');
  async function read(promise,signal){
    if(signal?.aborted)throw abort();
    let timer,cancel;
    const interrupted=new Promise((_,reject)=>{
      cancel=()=>reject(abort());signal?.addEventListener('abort',cancel,{once:true});
      timer=setTimeout(()=>reject(Error('The song file stopped responding. Check that it is available on this device and try again.')),45000);
    });
    try{return await Promise.race([promise,interrupted]);}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
  return {
    // Locate the embedded mute tracks in bytes. Keep references to file slices
    // while opening the original recording, even when the JSON contains Unicode.
    async playback(file,{signal,onProgress=()=>{}}={}){
      if(!(file.size>=16*1024*1024)||typeof file.slice!=='function')return JSON.parse(await read(file.text(),signal));
      const names=new Set(['accompanimentBase64','bassBase64','vocalsBase64']);
      const prefix='bss_'+crypto.randomUUID()+'_',ranges=new Map(),pieces=[];
      let start=-1,carry=0,key='',colon=false,selected=false,short='',kept=0;
      const step=2*1024*1024;
      for(let offset=0;offset<file.size;offset+=step){
        const block=new Uint8Array(await read(file.slice(offset,offset+step).arrayBuffer(),signal));
        let at=0;
        while(at<block.length){
          const quote=block.indexOf(34,at),end=quote<0?block.length:quote;
          if(start<0){
            if(key)for(let i=at;i<end;i++){
              const c=block[i];if(c===32||c===9||c===10||c===13)continue;
              if(c===58&&!colon){colon=true;continue;}
              key='';break;
            }
            if(quote<0)break;
            start=offset+quote;selected=!!key&&colon;key='';colon=false;short='';carry=0;at=quote+1;continue;
          }
          if(short!==null){
            if(short.length+end-at>20)short=null;
            else short+=String.fromCharCode(...block.subarray(at,end));
          }
          let slash=end;
          while(slash>at&&block[slash-1]===92)slash--;
          const parity=(end-slash+(slash===at?carry:0))%2;
          if(quote<0){carry=parity;break;}
          at=quote+1;carry=0;
          if(parity){short=null;continue;}
          if(selected&&offset+quote-start>65536){
            const id=prefix+ranges.size;
            pieces.push(file.slice(kept,start),JSON.stringify(id));
            kept=offset+quote+1;ranges.set(id,file.slice(start,kept));
          }
          key=names.has(short)?short:'';colon=false;start=-1;
        }
        onProgress(Math.floor(100*Math.min(offset+step,file.size)/file.size));
      }
      if(start>=0)throw SyntaxError('Incomplete saved song');
      pieces.push(file.slice(kept));
      const deferred=[];
      const project=JSON.parse(await read(new Blob(pieces).text(),signal),function(key,value){
        const part=ranges.get(value);
        if(!part)return value;
        deferred.push({owner:this,key,part});
        return part;
      });
      for(const {owner,key,part} of deferred){
        if(owner!==project?.analysis?.bassBacking)owner[key]=JSON.parse(await read(part.text(),signal));
      }
      return project;
    },
    async loadBacking(value){
      if(!value)return value;
      const result={...value};
      for(const key of ['accompanimentBase64','bassBase64','vocalsBase64']){
        const part=result[key];
        if(part instanceof Blob){
          const text=await read(part.slice(1,-1).text());
          result[key]=text.includes('\\')?JSON.parse('"'+text+'"'):text;
        }
      }
      return result;
    },
    async read(file,options){
      if(options?.playback)return this.playback(file,options);
      if(options?.signal?.aborted)throw abort();
      if(file.size<16*1024*1024||typeof file.stream!=='function'||typeof TextDecoderStream!=='function')
        return JSON.parse(await read(file.text(),options?.signal));
      const reader=file.stream().pipeThrough(new TextDecoderStream()).getReader();
      const prefix='bss_'+crypto.randomUUID()+'_',values=new Map(),metadata=[];
      let inString=false,afterColon=false,escapedNext=false,segments=[],length=0,finished=false;
      try{
        for(;;){
          const {value:block,done}=await read(reader.read(),options?.signal);
          if(done){finished=true;break;}
          let at=0;
          while(at<block.length){
            if(!inString){
              const quote=block.indexOf('"',at),end=quote<0?block.length:quote;
              const gap=block.slice(at,end);metadata.push(gap);
              const trimmed=gap.trimEnd();if(trimmed)afterColon=trimmed.endsWith(':');
              at=end;if(quote<0)break;
              at++;inString=true;segments=[];length=0;escapedNext=false;
            }
            const special=/\\[\s\S]|\\$|"/g;
            special.lastIndex=at+(escapedNext&&at<block.length?1:0);
            escapedNext=false;
            let token;
            while((token=special.exec(block))&&token[0]!=='"'){
              if(token[0]==='\\')escapedNext=true;
            }
            const end=token?token.index:block.length;
            const piece=block.slice(at,end);segments.push(piece);length+=piece.length;at=end;
            if(!token)break;
            const raw=segments.join('');
            if(afterColon&&length>=65536&&!raw.includes('\\')){
              // Only valid JSON characters may bypass JSON.parse's string validation.
              if(/[\u0000-\u001f]/.test(raw))throw SyntaxError('Invalid character in saved audio');
              const id=prefix+values.size;values.set(id,raw);metadata.push('"',id,'"');
            }else metadata.push('"',raw,'"');
            segments=[];at++;inString=false;afterColon=false;
          }
        }
        if(inString)throw SyntaxError('Incomplete saved project');
        return JSON.parse(metadata.join(''),(_,value)=>typeof value==='string'&&values.has(value)?values.get(value):value);
      }finally{
        // An unresponsive source must not delay cancellation or a fresh attempt.
        if(!finished)try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
        reader.releaseLock();
      }
    }
  };
})();
