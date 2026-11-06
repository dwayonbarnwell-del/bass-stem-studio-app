const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const file='index.html';
let html=fs.readFileSync(file,'utf8');
const links=fs.readFileSync('billing-source/links.js','utf8').trim();
const ui=fs.readFileSync('billing-source/ui.js','utf8').trim();
assert(html.includes('<script id="rc193-settings">'),'Settings entry missing');
assert(html.includes('settingsDialog'),'Settings dialog missing');
assert(html.includes('settingsClose'),'Settings close button missing');
if(!html.includes('<script id="rc199-payment-links">')){
  const anchor='<script id="rc193-settings">';
  const start=html.indexOf(anchor),end=html.indexOf('</script>',start);
  assert(end>start,'Settings script ending not found');
  html=html.slice(0,end+9)+'\n<script id="rc199-payment-links">\n'+links+'\n'+ui+'\n</script>'+html.slice(end+9);
}
for(const [i,m] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()){
  new vm.Script(m[1],{filename:'inline-'+i+'.js'});
}
for(const host of ['dashboard.render.com/billing','console.runpod.io/user/billing','github.com/settings/billing']){
  assert(html.includes(host),'Billing destination missing: '+host);
}
fs.writeFileSync(file,html);
console.log('PASS: Payment shortcuts in Settings, all existing inline scripts parse.');
