import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../db/index';
import { candidates } from '../../../db/schema';
import { and,eq } from 'drizzle-orm';
import { candidateInput } from '../../../lib/model';

function owner(req:NextRequest){return req.cookies.get('hireflow_workspace')?.value;}
function mutationAllowed(req:NextRequest){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export async function GET(req:NextRequest){
 try {
 const key=owner(req)||crypto.randomUUID();
 const data=await getDb().select().from(candidates).where(eq(candidates.owner,key));
 const res=NextResponse.json(data.map(({owner,...rest})=>rest));
 res.headers.set('Cache-Control','no-store');
 if(!owner(req))res.cookies.set('hireflow_workspace',key,{httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',maxAge:31536000,path:'/'});
 return res;
 } catch {return NextResponse.json({error:'Could not load candidates. Please retry.'},{status:503});}
}
export async function POST(req:NextRequest){
 if(!mutationAllowed(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const key=owner(req);if(!key)return NextResponse.json({error:'Reload to initialize your workspace.'},{status:401});
 try {
 const raw=await req.json() as Record<string,unknown>; const parsed=candidateInput.safeParse(raw);
 if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0].message},{status:400});
 const input=parsed.data;const db=getDb();const now=new Date().toISOString();
 const list=await db.select().from(candidates).where(eq(candidates.owner,key));
 if(list.some(c=>c.email===input.email&&c.id!==raw.id))return NextResponse.json({error:'A candidate with this email already exists.'},{status:409});
 if(raw.id){
 const old=list.find(c=>c.id===raw.id);if(!old)return NextResponse.json({error:'Candidate not found.'},{status:404});
 const history=JSON.parse(old.history);if(old.stage!==input.stage)history.unshift({text:`Moved from ${old.stage} to ${input.stage}`,at:now});
 await db.update(candidates).set({...input,updatedAt:now,history:JSON.stringify(history)}).where(and(eq(candidates.id,old.id),eq(candidates.owner,key)));
 }else{
 if(list.length>=500)return NextResponse.json({error:'Demo limit: 500 candidates per workspace.'},{status:400});
 await db.insert(candidates).values({...input,id:crypto.randomUUID(),owner:key,createdAt:now,updatedAt:now,history:JSON.stringify([{text:`Added to ${input.stage}`,at:now}])});
 }
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Could not save candidate. Please retry.'},{status:500});}
}
export async function DELETE(req:NextRequest){
 if(!mutationAllowed(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const key=owner(req);if(!key)return NextResponse.json({error:'Workspace unavailable.'},{status:401});
 const id=new URL(req.url).searchParams.get('id');if(!id)return NextResponse.json({error:'Missing candidate ID.'},{status:400});
 try{await getDb().delete(candidates).where(and(eq(candidates.id,id),eq(candidates.owner,key)));return NextResponse.json({ok:true});}
 catch{return NextResponse.json({error:'Could not delete candidate.'},{status:500});}
}

