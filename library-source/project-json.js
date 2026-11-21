/* Read large portable projects without allocating a second full copy of all their audio. */
globalThis.BassProjectJSON={
  async read(file){
    if(file.size<16*1024*1024||typeof file.stream!=='function'||typeof TextDecoderStream!=='function')
      return JSON.parse(await file.text());
    const reader=file.stream().pipeThrough(new TextDecoderStream()).getReader();
    const prefix='bss_'+crypto.randomUUID()+'_',values=new Map(),metadata=[];
    let inString=false,afterColon=false,escapedNext=false,segments=[],length=0;
    try{
      for(;;){
        const {value:block,done}=await reader.read();
        if(done)break;
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
    }finally{reader.releaseLock();}
  }
};
