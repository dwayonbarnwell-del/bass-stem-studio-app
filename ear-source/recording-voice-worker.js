// Estimate centred vocal frequencies in the backing. Bass and drum stems bypass this filter.
importScripts('../fretflow-source/practice-stems.js?v=rc361');
self.onmessage=({data:{left,right,rate}})=>{
 try{
  const {fftInPlace,ifftInPlace}=self.BassStemTransforms;
  const size=1024,hop=size/2,mid=new Float32Array(size),side=new Float32Array(size);
  const midImag=new Float32Array(size),sideImag=new Float32Array(size);
  const window=Float32Array.from({length:size},(_,i)=>Math.sin(Math.PI*(i+.5)/size));
  const vocal=new Float32Array(left.length);
  for(let start=-hop;start<left.length;start+=hop){
   for(let i=0;i<size;i++){
    const l=left[start+i]||0,r=right[start+i]||0;
    mid[i]=(l+r)*.5*window[i];side[i]=(l-r)*.5*window[i];
   }
   midImag.fill(0);sideImag.fill(0);
   fftInPlace(mid,midImag);fftInPlace(side,sideImag);
   for(let k=0;k<size;k++){
    const hz=Math.min(k,size-k)*rate/size;
    const m=mid[k]**2+midImag[k]**2,s=side[k]**2+sideImag[k]**2;
    const band=Math.min(1,Math.max(0,(hz-80)/120),Math.max(0,(9500-hz)/3500));
    const mask=band*Math.max(0,m-s)/(m+2*s+1e-16);
    mid[k]*=mask;midImag[k]*=mask;
   }
   ifftInPlace(mid,midImag);
   for(let i=Math.max(0,-start);i<Math.min(size,left.length-start);i++)vocal[start+i]+=mid[i]*window[i];
  }
  self.postMessage({vocal},[vocal.buffer]);
 }catch(error){self.postMessage({error:error.message});}
};
