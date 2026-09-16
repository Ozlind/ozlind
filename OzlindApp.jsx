'use client';
import {useEffect,useMemo,useRef,useState} from 'react';

const MODES=[['auto','Auto'],['fast','Fast'],['pro','Pro'],['vision','Vision'],['research','Research']];
const KEY='ozlind.conversations.v3'; const SETTINGS='ozlind.settings.v2';
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const titleOf=t=>{const s=t.replace(/\s+/g,' ').trim();return s.length>38?s.slice(0,38).trim()+'…':s||'New conversation'};

export default function OzlindApp(){
 const [chats,setChats]=useState([]),[active,setActive]=useState(null),[input,setInput]=useState(''),[mode,setMode]=useState('auto'),[busy,setBusy]=useState(false),[mobile,setMobile]=useState(false),[search,setSearch]=useState(''),[settingsOpen,setSettingsOpen]=useState(false),[custom,setCustom]=useState(''),[notice,setNotice]=useState('');
 const abortRef=useRef(null); const endRef=useRef(null); const fileRef=useRef(null);
 useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');setChats(Array.isArray(x)?x:[]);const s=JSON.parse(localStorage.getItem(SETTINGS)||'{}');setCustom(typeof s.custom==='string'?s.custom:'');}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(chats.slice(-30)))}catch{}},[chats]);
 useEffect(()=>{try{localStorage.setItem(SETTINGS,JSON.stringify({custom}))}catch{}},[custom]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[active,busy]);
 const current=useMemo(()=>chats.find(c=>c.id===active)||null,[chats,active]);
 const visible=useMemo(()=>chats.filter(c=>!search||c.title.toLowerCase().includes(search.toLowerCase())),[chats,search]);
 function newChat(){const c={id:uid(),title:'New conversation',messages:[],createdAt:Date.now()};setChats(x=>[...x,c]);setActive(c.id);setInput('');setMobile(false);setNotice('')}
 function updateChat(id,fn){setChats(x=>x.map(c=>c.id===id?fn(c):c))}
 async function send(text=input){const value=text.trim();if(!value||busy)return;let chat=current;if(!chat){const c={id:uid(),title:titleOf(value),messages:[],createdAt:Date.now()};setChats(x=>[...x,c]);setActive(c.id);chat=c}
  const user={id:uid(),role:'user',content:value};const assistant={id:uid(),role:'assistant',content:'',streaming:true};const next=[...(chat.messages||[]),user,assistant];updateChat(chat.id,c=>({...c,title:c.title==='New conversation'?titleOf(value):c.title,messages:next}));setInput('');setBusy(true);setNotice('');
  const controller=new AbortController();abortRef.current=controller;
  try{let researchContext='';let sources=[];if(mode==='research'){const rr=await fetch('/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:value}),signal:controller.signal});const rd=await rr.json();if(!rr.ok)throw new Error(rd.error||'Research unavailable');researchContext=JSON.stringify(rd);sources=rd.sources||[]}
   const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,messages:next.slice(0,-1).map(m=>({role:m.role,content:m.content})),customInstructions:custom,researchContext}),signal:controller.signal});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'OZLIND could not complete that request.')}
   const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){if(!line.startsWith('data:'))continue;try{const e=JSON.parse(line.slice(5).trim());if(e.type==='text'&&e.text)updateChat(chat.id,c=>({...c,messages:c.messages.map(m=>m.id===assistant.id?{...m,content:m.content+e.text,streaming:true}:m)}));}catch{}}}
   updateChat(chat.id,c=>({...c,messages:c.messages.map(m=>m.id===assistant.id?{...m,streaming:false,sources}:m)}));
  }catch(e){if(e.name!=='AbortError')updateChat(chat.id,c=>({...c,messages:c.messages.map(m=>m.id===assistant.id?{...m,content:e.message||"OZLIND couldn't complete that request.",error:true,streaming:false}:m)}));}
  finally{setBusy(false);abortRef.current=null}
 }
 function stop(){abortRef.current?.abort();setBusy(false);if(active)updateChat(active,c=>({...c,messages:c.messages.map(m=>m.streaming?{...m,streaming:false}:m)}))}
 function removeMessage(id){if(!active)return;updateChat(active,c=>({...c,messages:c.messages.filter(m=>m.id!==id)}))}
 function editMessage(m){setInput(m.content);removeMessage(m.id);window.setTimeout(()=>document.querySelector('textarea')?.focus(),0)}
 function regenerate(i){if(!current||busy||i<1)return;const prev=current.messages[i-1];if(prev?.role==='user'){updateChat(current.id,c=>({...c,messages:c.messages.slice(0,i)}));setTimeout(()=>send(prev.content),0)}}
 function clearChat(){if(active)updateChat(active,c=>({...c,messages:[]}))}
 function handleFiles(e){const files=[...e.target.files||[]].slice(0,4);if(files.length){setNotice(`${files.length} attachment${files.length>1?'s':''} selected. Attachments are sent with the next message.`);setInput(x=>x)} }
 return <div className="shell">
  <aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><span className="mark"><i/></span><span>OZLIND</span><button className="icon mobile-close" onClick={()=>setMobile(false)} aria-label="Close menu">×</button></div>
   <button className="new" onClick={newChat}><span>＋</span> New conversation</button>
   <div className="side-section"><small>Workspace</small><button className="nav active"><span>◈</span> AI Chat</button><button className="nav" onClick={()=>setMode('research')}><span>⌁</span> Research</button><button className="nav"><span>✦</span> Image creation <em>NEXT</em></button></div>
   <div className="side-section history"><small>Recent</small>{visible.slice().reverse().slice(0,8).map(c=><button className={`history-item ${c.id===active?'selected':''}`} key={c.id} onClick={()=>{setActive(c.id);setMobile(false)}}>{c.title}</button>)}{!visible.length&&<p className="muted">No conversations yet.</p>}</div>
   <div className="side-bottom"><button className="nav" onClick={()=>setSettingsOpen(true)}><span>⚙</span> Settings</button><div className="profile"><div className="avatar">A</div><div><strong>OZLIND</strong><small>Personal workspace</small></div></div></div>
  </aside>
  {mobile&&<button className="scrim" onClick={()=>setMobile(false)} aria-label="Close sidebar"/>}
  <main className="main"><header><button className="icon menu" onClick={()=>setMobile(true)} aria-label="Open menu">☰</button><div className="top-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search conversations"/><kbd>/</kbd></div><button className="icon" onClick={newChat} aria-label="New conversation">＋</button></header>
   <section className="workspace">
    {!current||!current.messages.length?<div className="welcome"><div className="hero-mark"><span className="mark big"><i/></span></div><p className="eyebrow">INTELLIGENCE, REFINED</p><h1>What can OZLIND<br/><span>help you create?</span></h1><p className="lead">A focused AI workspace for thinking, researching and making progress.</p><div className="prompts"><button onClick={()=>send('Explain this concept simply')}>Explain something simply <span>→</span></button><button onClick={()=>send('Help me plan a project')}>Help me plan a project <span>→</span></button><button onClick={()=>setMode('research')}>Research a current topic <span>→</span></button></div></div>:
      <div className="conversation"><div className="conversation-head"><div><span className="eyebrow">CONVERSATION</span><h2>{current.title}</h2></div><div className="head-actions"><button onClick={clearChat}>Clear</button></div></div><div className="messages">{current.messages.map((m,i)=><article className={`message ${m.role} ${m.error?'error':''}`} key={m.id}><div className="message-label">{m.role==='user'?'YOU':'OZLIND'}</div><div className="message-body">{m.content||<span className="thinking"><i/><i/><i/></span>}{m.streaming&&m.content&&<span className="cursor"/>}{m.sources?.length>0&&<div className="sources"><b>Sources</b>{m.sources.map((s,j)=><a key={j} href={s.url} target="_blank" rel="noreferrer"><span>{j+1}</span>{s.title||s.domain}</a>)}</div>}</div><div className="message-actions">{m.content&&<button onClick={()=>navigator.clipboard?.writeText(m.content)}>Copy</button>}{m.role==='user'&&<button onClick={()=>editMessage(m)}>Edit</button>}{m.role==='assistant'&&<button onClick={()=>regenerate(i)}>Regenerate</button>}<button onClick={()=>removeMessage(m.id)}>Delete</button></div></article>)}<div ref={endRef}/></div></div>}
    {notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    <div className="composer-wrap"><div className="mode-row">{MODES.map(([id,label])=><button key={id} className={mode===id?'chosen':''} onClick={()=>setMode(id)}>{label}</button>)}</div><div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask OZLIND anything…" rows={1}/><div className="composer-tools"><div><button className="attach" onClick={()=>fileRef.current?.click()} aria-label="Attach file">＋</button><input ref={fileRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,text/csv" onChange={handleFiles}/><span className="hint">Shift + Enter for new line</span></div>{busy?<button className="send stop" onClick={stop}>■</button>:<button className="send" onClick={()=>send()} disabled={!input.trim()}>↑</button>}</div></div><p className="disclaimer">OZLIND can make mistakes. Check important information.</p></div>
   </section>
  </main>
  {settingsOpen&&<div className="modal-layer"><div className="modal"><div className="modal-head"><div><span className="eyebrow">PREFERENCES</span><h2>Settings</h2></div><button className="icon" onClick={()=>setSettingsOpen(false)}>×</button></div><label>Custom instructions<textarea value={custom} onChange={e=>setCustom(e.target.value.slice(0,3000))} placeholder="Tell OZLIND how you prefer to work…"/></label><p>These preferences apply to future AI responses and stay on this device.</p><button className="primary" onClick={()=>setSettingsOpen(false)}>Save preferences</button></div></div>}
 </div>
}
