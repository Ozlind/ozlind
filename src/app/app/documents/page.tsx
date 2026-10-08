"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Search, Trash2, Upload } from "lucide-react";

type DocumentRow={id:string;name:string;mime:string;size_bytes:number|null;chunk_count:number;status:string;created_at:string};
type Result={id:string;name:string;content:string;similarity:number};

export default function DocumentsPage(){
  const input=useRef<HTMLInputElement>(null);
  const [documents,setDocuments]=useState<DocumentRow[]>([]);
  const [results,setResults]=useState<Result[]|null>(null);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    const r=await fetch("/api/documents",{cache:"no-store"});
    if(!r.ok){setError("Could not load your documents.");return;}
    const b=await r.json();setDocuments(b.documents??[]);
  }
  useEffect(()=>{void load()},[]);

  async function upload(file:File){
    setBusy(true);setError("");
    try{
      if(file.size>2_000_000) throw new Error("Maximum document size is 2 MB.");
      const content=await file.text();
      const r=await fetch("/api/documents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,mime:file.type||"text/plain",sizeBytes:file.size,content})});
      const b=await r.json().catch(()=>null);
      if(!r.ok) throw new Error(b?.error?.message||"Document processing failed.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Document upload failed.")}finally{setBusy(false)}
  }

  async function remove(id:string){
    if(!window.confirm("Delete this document?"))return;
    const r=await fetch("/api/documents?id="+encodeURIComponent(id),{method:"DELETE"});
    if(!r.ok){setError("Could not delete the document.");return}
    setDocuments(v=>v.filter(x=>x.id!==id));
  }

  async function search(e:React.FormEvent){
    e.preventDefault(); if(!query.trim())return;
    setBusy(true);setError("");
    try{const r=await fetch("/api/documents?q="+encodeURIComponent(query.trim()));const b=await r.json();if(!r.ok)throw new Error("Document search failed.");setResults(b.results??[])}catch(e){setError(e instanceof Error?e.message:"Document search failed.")}finally{setBusy(false)}
  }

  return <main className="settings-page">
    <header className="settings-header"><div><p className="eyebrow">Private workspace</p><h1>Documents</h1><p>Build a private knowledge library for Ozlind.</p></div><Link href="/app" className="text-button">Back to chat</Link></header>
    {error&&<div className="error-card" role="alert">{error}</div>}
    <section className="settings-section"><div className="settings-grid">
      <button className="setting-row" onClick={()=>input.current?.click()} disabled={busy}><span><Upload size={17}/> Add TXT, Markdown, CSV or JSON</span>{busy?<Loader2 size={17}/>:<span>{documents.length}/20</span>}</button>
      <input ref={input} hidden type="file" accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void upload(f)}}/>
    </div></section>
    <section className="settings-section"><form className="search-box" onSubmit={search}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your documents…"/><button className="text-button" type="submit">Search</button></form></section>
    {results?<section className="settings-section"><h2>Relevant passages</h2><div className="settings-grid">{results.length?results.map(x=><article className="setting-row" key={x.id}><span><strong>{x.name}</strong><small>{x.content}</small></span><span>{x.similarity.toFixed(2)}</span></article>):<p className="settings-muted">No relevant passages found.</p>}</div></section>:<section className="settings-section"><h2>Your library</h2><div className="settings-grid">{documents.length?documents.map(d=><article className="setting-row" key={d.id}><span><strong><FileText size={16}/> {d.name}</strong><small>{d.chunk_count} chunks · {d.status}</small></span><button className="icon-button" onClick={()=>void remove(d.id)} aria-label={"Delete "+d.name}><Trash2 size={17}/></button></article>):<p className="settings-muted">No documents yet.</p>}</div></section>}
  </main>;
}
