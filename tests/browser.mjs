const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { mkdir,rename } from 'node:fs/promises';
const base=process.env.BASE_URL||'http://localhost:5173';
const out=process.env.DEMO_OUTPUT||'work/browser-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.env.DISABLE_HTTP2 ? ['--disable-http2'] : []});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});
const page=await context.newPage();
page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(120000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function caption(text){console.log(text);await page.evaluate(text=>{let el=document.getElementById('demo-caption');if(!el){el=document.createElement('div');el.id='demo-caption';el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:200;background:#26312aed;color:white;padding:16px 28px;border-radius:12px;font:500 17px sans-serif;box-shadow:0 4px 25px #20162c33;pointer-events:none;max-width:90%;text-align:center';document.body.appendChild(el);}el.textContent=text;},text);await page.waitForTimeout(2600);}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});console.log('Page loaded');await page.getByRole('button',{name:'Load sample candidates',exact:true}).waitFor();
 await caption('Hireflow — candidate management');
 await page.getByRole('button',{name:'Load sample candidates',exact:true}).click();
 await page.getByText('Arjun Verma',{exact:true}).first().waitFor();
 await caption('Dashboard totals and candidate stage distribution');
 await page.screenshot({path:out+'/dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Add candidate',exact:true}).click();
 await page.getByLabel('Full name').fill('Aditi Kulkarni');
 await page.getByLabel('Email address').fill('aditi.demo@example.com');
 await page.getByLabel('Location',{exact:true}).fill('Pune');
 await page.getByLabel('Skills',{exact:true}).fill('React, TypeScript, Accessibility');
 await page.getByLabel('Experience (years)').fill('2');
 await page.getByLabel('Recruiter notes').fill('Strong frontend portfolio. Available to interview next week.');
 await caption('Add a candidate with contact details, experience and notes');
 await page.getByRole('button',{name:'Add candidate',exact:true}).last().click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/Candidates.*10/}).click();
 await page.getByRole('textbox',{name:'Search candidates'}).fill('Accessibility');
 await page.getByRole('cell',{name:'Aditi Kulkarni aditi.demo@example.com'}).waitFor();
 assert.equal(await page.locator('tbody tr').count(),1);
 await caption('Find the right person by name, email, role, location, or skill');
 await page.getByRole('cell',{name:'Aditi Kulkarni aditi.demo@example.com'}).click();
 await page.getByLabel('Move to stage').selectOption('Interview');
 await page.getByText('Moved from Applied to Interview',{exact:true}).waitFor();
 await caption('Update a hiring stage and review its history');
 await page.getByRole('button',{name:'Edit candidate',exact:true}).click();
 await page.getByLabel('Recruiter notes').fill('Frontend interview confirmed. Strong React and accessibility skills.');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Pipeline',exact:true}).click();
 await page.getByText('Aditi Kulkarni',{exact:true}).waitFor();
 const card=page.getByRole('button',{name:/AK.*Aditi Kulkarni/});
 await card.dragTo(page.locator('.board-column').filter({has:page.getByRole('heading',{name:/Offer/})}),{sourcePosition:{x:20,y:20},targetPosition:{x:80,y:20}});
 await page.locator('.board-column').filter({has:page.getByRole('heading',{name:/Offer/})}).getByText('Aditi Kulkarni',{exact:true}).waitFor();
 await caption('Move a candidate using the pipeline board');
 await page.screenshot({path:out+'/pipeline.png',fullPage:true});
 await page.getByRole('button',{name:'Candidates',exact:false}).first().click();
 await page.getByLabel('Filter by stage').selectOption('Offer');
 await page.getByLabel('Filter by position').selectOption('Frontend Developer');
 assert.equal(await page.locator('tbody tr').count(),2);
 await caption('Filter by role and stage, then export the results');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();await (await download).saveAs(out+'/candidate-export.csv');
 await page.reload();await page.getByRole('button',{name:/Candidates.*10/}).waitFor();
 await caption('Candidate records and notes remain after a page refresh');
 // API checks: validation, duplicate email, persistence, isolation and delete.
 const api=context.request;
 let r=await api.get(base+'/api/candidates');let data=await r.json();assert.equal(data.length,10);
 const c=data.find(c=>c.email==='aditi.demo@example.com');assert.equal(c.stage,'Offer');assert.match(c.notes,/confirmed/);
 r=await api.post(base+'/api/candidates',{data:{...c,id:undefined}});assert.equal(r.status(),409);
 r=await api.post(base+'/api/candidates',{data:{...c,email:'bad'}});assert.equal(r.status(),400);
 const other=await browser.newContext();await other.request.get(base+'/api/candidates');
 r=await other.request.get(base+'/api/candidates');assert.equal((await r.json()).length,0);
 r=await other.request.post(base+'/api/candidates',{data:c});assert.equal(r.status(),404);await other.close();
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 await caption('Overview totals update as candidates move through the pipeline');
 await page.screenshot({path:out+'/dashboard-final.png',fullPage:true});
 const mobile=await browser.newContext({viewport:{width:390,height:844}});await mobile.addCookies(await context.cookies());
 const mp=await mobile.newPage();await mp.goto(base,{waitUntil:'domcontentloaded'});await mp.getByText('Total candidates',{exact:true}).waitFor();
 await mp.screenshot({path:out+'/mobile.png',fullPage:true});
 assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await mobile.close();
 await api.delete(base+'/api/candidates?id='+c.id,{maxRetries:2});r=await api.get(base+'/api/candidates',{maxRetries:2});assert.equal((await r.json()).length,9);
 // Real table behavior and dialog keyboard focus after the library upgrade.
 for(const name of ['Table Check A','Table Check Z']) {
   r=await api.post(base+'/api/candidates',{data:{...c,id:undefined,name,email:name.replaceAll(' ','').toLowerCase()+'@example.com'}});assert.equal(r.status(),200);
 }
 await page.reload();await page.getByRole('button',{name:/Candidates.*11/}).click();
 await page.getByRole('button',{name:'Sort by Candidate',exact:true}).click();
 let names=await page.locator('tbody .person strong').allTextContents();assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b)));
 await page.getByRole('button',{name:'Next page',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByRole('button',{name:'Previous page',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),10);
 await page.getByLabel('Rows per page').selectOption('25');assert.equal(await page.locator('tbody tr').count(),11);
 await page.locator('tbody tr').first().press('Enter');await page.getByRole('dialog').waitFor();
 for(let i=0;i<15;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]')),true);}
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Interview 2',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),2);
 await caption('Sort candidates, control page size and jump to a hiring stage');
 r=await api.get(base+'/api/candidates',{maxRetries:2});for(const record of await r.json())if(record.name.startsWith('Table Check '))await api.delete(base+'/api/candidates?id='+record.id,{maxRetries:2});
 assert.deepEqual(errors,[]);
 console.log('PASS: create, edit, stage dropdown, drag/drop, history, search, combined filters, export, persistence, validation, duplicate protection, workspace isolation, deletion, sorting, pagination, page size, stage tabs, dialog focus trap and Escape, desktop/mobile layout, no browser runtime errors.');
}finally{const video=page.video();await context.close();if(video)await rename(await video.path(),out+'/Hireflow-demo.webm');await browser.close();}


