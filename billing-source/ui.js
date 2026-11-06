/* RC199: account billing shortcuts inside existing Settings. */
(()=>{
 const d=document.getElementById('settingsDialog'),close=document.getElementById('settingsClose');
 if(!d||!close||d.querySelector('#billingShortcuts'))return;
 const block=document.createElement('section');block.id='billingShortcuts';
 const h=document.createElement('h3');h.textContent='Payments & Billing';block.append(h);
 const links=document.createElement('div');links.className='billing-links';
 for(const [name,url] of Object.entries(window.BassBillingLinks||{})){
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=name==='runpod'?'RunPod':name==='github'?'GitHub':'Render';links.append(a);
 }
 block.append(links);close.before(block);
 const style=document.createElement('style');
 style.textContent='#settingsDialog #billingShortcuts{margin:16px 0;padding:14px;border:1px solid #55788a;border-radius:12px;color:#fff;background:#14283b}#settingsDialog #billingShortcuts h3{text-align:center;font:700 16px system-ui;margin:0 0 10px}#settingsDialog .billing-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#settingsDialog .billing-links a{display:flex;min-width:0;min-height:54px;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;border:1px solid #6893aa;border-radius:10px;background:#205371;color:#fff;font:700 14px system-ui;text-decoration:none}@media(max-width:350px){#settingsDialog .billing-links{grid-template-columns:1fr}}';
 document.head.append(style);
})();