const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function navigation(){
 const win=new EventTarget();let pos=0,states=[{}];
 const history={get state(){return states[pos]},pushState(s){states=states.slice(0,pos+1);states.push(s);pos++},back(){if(pos){pos--;setImmediate(()=>win.dispatchEvent(new Event('popstate')));}}};
 class Dialog extends EventTarget{showModal(){this.open=true;}close(){if(!this.open)return;this.open=false;setImmediate(()=>this.dispatchEvent(new Event('close')));}}
 vm.runInNewContext(read('library-source/navigation.js'),{window:win,HTMLDialogElement:Dialog,history,queueMicrotask,Event});
 const parent=new Dialog(),child=new Dialog();parent.showModal();child.showModal();assert.equal(pos,1);
 history.back();await tick();assert.equal(child.open,false);assert.equal(parent.open,true);assert.equal(pos,1);
 let page='edit';parent.addEventListener('cancel',e=>{if(page!=='list'){e.preventDefault();page=page==='edit'?'overview':'list';}});
 history.back();await tick();assert.equal(page,'overview');assert(parent.open);
 history.back();await tick();assert.equal(page,'list');assert(parent.open);
 history.back();await tick();assert.equal(parent.open,false);assert.equal(pos,0);
 parent.showModal();parent.close();await tick();await tick();assert.equal(pos,0);
 parent.showModal();child.showModal();child.close();await tick();assert(parent.open);assert.equal(pos,1);parent.close();await tick();await tick();assert.equal(pos,0);
}
navigation().then(()=>console.log('PASS: nested Back navigation and modal cleanup.')).catch(e=>{console.error(e);process.exitCode=1;});
