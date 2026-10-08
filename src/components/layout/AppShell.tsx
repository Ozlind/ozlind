"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePreferences } from "@/hooks/usePreferences";

export function AppShell({user,children}:{user:{id:string;email:string;displayName:string};children:React.ReactNode}) {
  const [open,setOpen]=useState(false);
  const {preferences}=usePreferences();

  useEffect(()=>{
    const root=document.documentElement;
    root.dataset.density=preferences.density;
    root.dataset.layout=preferences.layout;
    root.style.setProperty("--accent", preferences.accent);
    root.style.setProperty("--accent-fg", "#fff");
    const applyTheme=()=>{
      const dark=preferences.theme==="dark" || (preferences.theme==="system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme=dark?"dark":"light";
    };
    applyTheme();
    if(preferences.theme!=="system") return;
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return()=>media.removeEventListener("change", applyTheme);
  },[preferences]);

  return <div className="app-shell"><Sidebar user={user} mobileOpen={open} onClose={()=>setOpen(false)}/><div className="app-main"><button className="mobile-menu" onClick={()=>setOpen(true)} aria-label="Open sidebar"><Menu size={20}/></button>{children}</div></div>;
}