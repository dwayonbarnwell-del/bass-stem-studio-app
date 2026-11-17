const fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const html=fs.readFileSync('index.html','utf8'),base=fs.readFileSync('tests/browser_song_repeat_rc286.js','utf8');
 const hook=base.replace(' out.textContent+=`DONE ',fs.readFileSync('tests/browser_song_review_rc287.js','utf8')+'\n out.textContent+=`DONE ');
 let inserted=false;
 const build=html.replace('<head>','<head><base href="/">').replace(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi,(whole,js)=>{
  if(!js.includes('function studySong()'))return whole;
  inserted=true;const i=js.lastIndexOf('})();');return whole.replace(js,js.slice(0,i)+hook+'\n'+js.slice(i));
 });
 if(!inserted)throw Error('Application hook not found');
 if(process.env.BUILD_ONLY){fs.writeFileSync(process.env.BUILD_ONLY,build);return;}
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium'});let failed=0;
 try{for(const [width,height]of (process.env.QUICK?[[360,800]]:[[360,800],[412,915],[844,390],[1280,900]])){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(u.protocol))return route.abort();return route.continue();});
  await page.route('**/audit-song-review.html',r=>r.fulfill({body:build,contentType:'text/html'}));
  await page.goto('http://127.0.0.1:'+(process.env.TEST_PORT||4174)+'/audit-song-review.html');
  await page.locator('#svRun').click();await page.waitForFunction(()=>document.getElementById('svResults').textContent.includes('DONE '),{},{timeout:120000});
  const result=await page.locator('#svResults').textContent();console.log(width+'x'+height+' '+result.match(/DONE .*/)?.[0]);
  for(const line of result.split('\n').filter(l=>/^(FAIL|SKIP)/.test(l)))console.log(line);
  if(!result.includes('; 0 failed')||errors.length){failed++;console.log('PAGE ERRORS',errors);}
  if(process.env.EVIDENCE_DIR){fs.mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});fs.writeFileSync(process.env.EVIDENCE_DIR+'/song-review-'+width+'.txt',result+'\n'+errors.join('\n'));await page.locator('#svSample').click();await page.waitForFunction(()=>document.getElementById('svTest').hidden);await page.screenshot({path:process.env.EVIDENCE_DIR+'/song-review-'+width+'.png'});}
  await context.close();
 }}finally{await browser.close();}process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
