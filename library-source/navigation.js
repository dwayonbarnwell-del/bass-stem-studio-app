/* Keep browser/Android Back within the open section, including nested dialogs. */
(()=>{
 'use strict';
 const proto=HTMLDialogElement.prototype,show=proto.showModal,close=proto.close;
 const stack=[];let armed=false,removing=false;
 const top=()=>{while(stack.length&&!stack.at(-1).open)stack.pop();return stack.at(-1);};
 const arm=()=>{if(!armed&&!removing&&top()){history.pushState({...history.state,bassDialog:true},'');armed=true;}};
 function sync(){
  if(top()){arm();return;}
  if(armed){armed=false;removing=true;history.back();}
 }
 proto.showModal=function(...args){
  const wasOpen=this.open;const result=show.apply(this,args);
  if(!wasOpen){stack.push(this);this.addEventListener('close',sync,{once:true});arm();}
  return result;
 };
 proto.close=function(...args){const result=close.apply(this,args);queueMicrotask(sync);return result;};
 window.addEventListener('popstate',()=>{
  if(removing){removing=false;arm();return;}
  if(!armed)return;
  armed=false;const dialog=top();if(!dialog)return;
  // Existing cancel handlers save edits and step back inside their section.
  const event=new Event('cancel',{cancelable:true});
  if(dialog.dispatchEvent(event))dialog.close();
  arm();
 });
})();
