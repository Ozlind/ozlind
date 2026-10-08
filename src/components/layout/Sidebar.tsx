"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MessageSquarePlus, Search, Settings, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export function Sidebar({user,mobileOpen,onClose}:{user:{id:string;email:string;displayName:string};mobileOpen:boolean;onClose:()=>void}) {
  const router=useRouter(); const path=usePathname(); const [q,setQ]=useState("");
  const {data=[]}=useQuery({queryKey:["conversations",user.id],queryFn:async()=>{const supabase=createClient();const{data,error}=await supabase.from("conversations").select("id,title,updated_at").eq("user_id",user.id).eq("archived",false).order("updated_at",{ascending:false}).limit(100);if(error)throw error;return data??[]}});
  async function signOut(){const supabase=createClient();await supabase.auth.signOut();window.location.assign("/login")}
  return <aside className={"sidebar "+(mobileOpen?"sidebar-open":"")}>
    <div className="sidebar-top">
      <div className="sidebar-brand"><Image src="/ozlind-mark.svg" alt="Ozlind" width={32} height={32}/><span>Ozlind</span><button className="icon-button mobile-close" onClick={onClose} aria-label="Close sidebar"><X size={20}/></button></div>
      <Button onClick={()=>{router.push("/app");onClose()}}><MessageSquarePlus size={18}/>New chat</Button>
      <label className="search-box"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search conversations"/></label>
    </div>
    <nav className="conversation-list">{data.filter(x=>x.title.toLowerCase().includes(q.toLowerCase())).map(x=><Link key={x.id} href={"/app/"+x.id} onClick={onClose} className={path==="/app/"+x.id?"conversation-link active":"conversation-link"}>{x.title||"New conversation"}</Link>)}</nav>
    <div className="sidebar-actions"><Link href="/app/settings" className="sidebar-action" onClick={onClose}><Settings size={17}/>Settings</Link></div>
    <div className="sidebar-user"><div className="user-avatar">{(user.displayName||user.email||"U").slice(0,1).toUpperCase()}</div><div className="user-copy"><strong>{user.displayName||"Ozlind user"}</strong><span>{user.email}</span></div><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={18}/></button></div>
  </aside>
}