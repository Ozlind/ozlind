"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/client";

function BootScreen() {
  return (
    <main className="ozlind-boot" aria-label="Loading OZLIND AI" aria-busy="true">
      <div className="ozlind-boot-orb ozlind-boot-orb-one" />
      <div className="ozlind-boot-orb ozlind-boot-orb-two" />

      <div className="ozlind-boot-content">
        <div className="ozlind-boot-logo-wrap" aria-hidden="true">
          <svg
            className="ozlind-boot-logo"
            viewBox="0 0 96 96"
            aria-hidden="true"
          >
            <use href="/ozlind-icons.svg#ozl-mark" />
          </svg>
        </div>

        <div className="ozlind-boot-wordmark">
          <strong>OZLIND</strong>
          <span>AI</span>
        </div>

        <p>Preparing your workspace…</p>

        <div className="ozlind-boot-loader" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  const router = useRouter();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let mounted = true;
    let bootTimer = null;
    let authSubscription = null;

    async function initialize() {
      try {
        const supabase = await createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !user) {
          router.replace("/login");
          return;
        }

        setStatus("booting");

        bootTimer = window.setTimeout(() => {
          if (mounted) {
            setStatus("ready");
          }
        }, 700);

        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (!mounted) return;

          if (event === "SIGNED_OUT") {
            router.replace("/login");
          }
        });

        authSubscription = data?.subscription || null;
      } catch (error) {
        console.error("OZLIND authentication initialization failed:", error);

        if (mounted) {
          router.replace("/login?error=auth_init");
        }
      }
    }

    initialize();

    return () => {
      mounted = false;

      if (bootTimer) {
        window.clearTimeout(bootTimer);
      }

      authSubscription?.unsubscribe();
    };
  }, [router]);

  if (status !== "ready") {
    return <BootScreen />;
  }

  return <OzlindApp />;
}
