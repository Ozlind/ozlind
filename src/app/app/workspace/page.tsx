"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Preset={id:string;name:string;system_prompt:string;model:string};
type Artifact={id:string;title:string;kind:string;content:string;version:number};
export default function WorkspacePage(){
 const[presets,setPresets]=useState<Preset[]>([]);const[artifacts,setArtifacts]=useState<Artifact[]>([]);const[name,setName]=useState("");const[prompt,setPrompt]=useState("");const[busy,setBusy]=useState(false);
 async function load(){const[a,b]=await Promise.all([fetch("/api/presets",{cache:"no-store"}),fetch("/api/artifacts",{cache:"no-store"})]);const ap=await a.json();const ab=await b.json();setPresets(ap.presets??[]);setArtifacts(ab.artifacts??[])}
 useEffect(()=>{void load()},[]);
 async function addPreset(e:React.FormEvent){e.preventDefault();if(!name.trim()||!prompt.trim())return;setBusy(true);try{const r=await fetch("/api/presets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,system_prompt:prompt,model:"groq:llama-3.3-70b-versatile"})});if(r.ok){setName("");setPrompt("");await load()}}finally{setBusy(false)}}
 async function removePreset(id:string){await fetch("/api/presets?id="+id,{method:"DELETE"});setPresets(v=>v.filter(x=>x.id!==id))}
 async function removeArtifact(id:string){await fetch("/api/artifacts?id="+id,{method:"DELETE"});setArtifacts(v=>v.filter(x=>x.id!==id))}
 return <main className="settings-page"><header className="settings-header"><div><p className="eyebrow">Workspace</p><h1>Presets & artifacts</h1><p>Reusable instructions and saved work, scoped to your account.</p></div><Link href="/app" className="text-button">Back to chat</Link></header>
 <section className="settings-section"><h2>Create preset</h2><form className="stack-4" onSubmit={addPreset}><input className="ui-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Preset name"/><textarea className="ui-input" style={{height:120,paddingTop:10}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="System instructions for this preset"/><button className="ui-button ui-button-primary" disabled={busy}>Save preset</button></form></section>
 <section className="settings-section"><h2>Presets</h2><div className="settings-grid">{presets.length?presets.map(x=><article className="setting-row" key={x.id}><span><strong>{x.name}</strong><small>{x.system_prompt}</small></span><button className="icon-button" onClick={()=>void removePreset(x.id)} aria-label={"Delete "+x.name}>×</button></article>):<p className="settings-muted">No presets yet.</p>}</div></section>
 <section className="settings-section"><h2>Artifacts</h2><div className="settings-grid">{artifacts.length?artifacts.map(x=><article className="setting-row" key={x.id}><span><strong>{x.title}</strong><small>{x.kind} · v{x.version}</small></span><button className="icon-button" onClick={()=>void removeArtifact(x.id)} aria-label={"Delete "+x.title}>×</button></article>):<p className="settings-muted">Artifacts created by future chat actions will appear here.</p>}</div></section>
 </main>
}
