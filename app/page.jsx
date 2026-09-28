"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OzlindApp from "@/components/OzlindApp";

function BootScreen() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#0B0C0E",
        color: "#F2F3F4",
      }}
      aria-label="Loading OZLIND"
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            border: "1px solid #2A2D31",
            background: "#151719",
            boxShadow: "0 12px 40px rgba(0,0,0,.28)",
          }}
        >
          <span
            style={{
              fontSize: 25,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            O
          </span>
        </div>

        <div
          style={{
            width: 22,
            height: 22,
            border: "2px solid #2A2D31",
            borderTopColor: "#C98A52",
            borderRadius: "50%",
            animation: "ozlindBootSpin .8s linear infinite",
          }}
        />

        <span
          style={{
            fontSize: 13,
            color: "#9B9FA5",
          }}
        >
          Starting OZLIND…
        </span>
      </div>

      <style jsx>{`
        @keyframes ozlindBootSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

export default function Page() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    let redirectTimer;

    async function initializeSession() {
      try {
        const supabase = await createClient();

        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !currentUser) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);

        redirectTimer = window.setTimeout(() => {
          if (mounted) {
            setChecking(false);
          }
        }, 350);
      } catch (error) {
        console.error("OZLIND session initialization failed:", error);

        if (mounted) {
          router.replace("/login");
        }
      }
    }

    initializeSession();

    return () => {
      mounted = false;

      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [router]);

  if (checking || !user) {
    return <BootScreen />;
  }

  return <OzlindApp initialUser={user} />;
}