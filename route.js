import { cleanText, json, rateLimit, originAllowed, parseBody } from '../../lib/server';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function POST(request){
 if(!originAllowed(request)) return json({error:'Request rejected.'},{status:403});
 const rl=rateLimit(request,{limit:12,windowMs:60000}); if(!rl.ok)return json({error:'OZLIND is temporarily busy. Please try again in a moment.'},{status:429});
 const body=await parseBody(request); const query=cleanText(body?.query,800); if(!query)return json({error:'Please enter a research question.'},{status:400});
 const key=process.env.TAVILY_API_KEY; if(!key)return json({error:'Research is temporarily unavailable.'},{status:503});
 try{const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({query,search_depth:'basic',max_results:5,include_answer:true}),cache:'no-store'});if(!r.ok)throw new Error();const d=await r.json();return json({researchUsed:true,answer:cleanText(d.answer,3000),sources:(Array.isArray(d.results)?d.results:[]).slice(0,5).map(x=>({title:cleanText(x.title,240),url:cleanText(x.url,1000),domain:cleanText(x.url,1000).replace(/^https?:\/\//,'').split('/')[0],content:cleanText(x.content,1800)}))});}catch{return json({error:'OZLIND could not complete the research right now.'},{status:503});}
}
