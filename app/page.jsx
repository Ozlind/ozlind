"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/client";

function OzlindMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <use href="/ozlind-icons.svg#ozl-mark" />
    </svg>
  );
}

function BootScreen() {
  return (
    <main className="ozlind-boot" aria-label="Loading OZLIND AI" aria-busy="true">
      <div className="ozlind-boot-orb ozlind-boot-orb-one" />
      <div className="ozlind-boot-orb ozlind-boot-orb-two" />

      <div className="ozlind-boot-content">
        <div className="ozlind-boot-logo-wrap">
          <OzllindMarkSafe />
        </div>
        <div className="ozlind-boot-wordmark">
          <strong>OZLIND</strong>
          <span>AI</span>
        </div>
        <div className="ozlind-boot-loader" aria-hidden="true">
          <span />
        </div>
        <p>Initializing your workspace</p>
      </div>
    </main>
  );
}

function OzllindMarkSafe() {
  return <OzllindMark className="ozlind-boot-logo" />;
}

export default function Page() {
  const router = useRouter();
  const [status, setStatus] = useState("booting");

  useEffect(() => {
    let mounted = true;
    let timer;

    async function initialize() {
      try {
        const supabase = await createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        timer = window.setTimeout(() => {
          if (!mounted) return;

          if (session) {
            setStatus("ready");
          } else {
            router.replace("/login");
          }
        }, 1100);
      } catch (error) {
        console.error("OZLIND session initialization failed:", error);

        timer = window.setTimeout(() => {
          if (mounted) router.replace("/login");
        }, 800);
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [router]);

  if (status !== "ready") {
    return <BootScreen />;
  }

  return <OzlindApp />;
}
