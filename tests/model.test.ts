import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateInput,summarize,filterCandidates} from '../lib/model.ts';
const base={name:'Test Person',email:'TEST@EXAMPLE.COM',role:'Frontend Developer',stage:'Applied',location:'Pune',skills:'React, TypeScript',experience:2,notes:'',source:'EarlyJobs'};
test('normalizes email and rejects invalid fields',()=>{
assert.equal(candidateInput.parse(base).email,'test@example.com');
for(const update of [{email:'bad'},{name:''},{stage:'Unknown'},{experience:-1},{experience:2.5},{notes:'x'.repeat(5001)}])assert.equal(candidateInput.safeParse({...base,...update}).success,false);
});
const items=['Applied','Interview','Hired','Rejected'].map((stage,i)=>({...candidateInput.parse({...base,stage}),id:String(i),createdAt:'2026-10-17',updatedAt:'2026-10-17',history:'[]'}));
test('metrics exclude hired and rejected from active',()=>{const m=summarize(items);assert.equal(m.total,4);assert.equal(m.active,2);assert.equal(m.interviews,1);assert.equal(m.hired,1);});
test('search combines stage and role filters',()=>{
assert.equal(filterCandidates(items,'REACT','Interview','Frontend Developer').length,1);
assert.equal(filterCandidates(items,'pune','','').length,4);
assert.equal(filterCandidates(items,'no match','','').length,0);
});
test('empty metrics are zero',()=>{const m=summarize([]);assert.equal(m.total,0);assert.equal(m.active,0);});
