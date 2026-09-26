"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OzlindApp() {
  const [status, setStatus] = useState("Checking OZLIND...");

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const supabase = createClient();

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setStatus("OZLIND COMPONENT WORKS — AUTH ERROR");
          return;
        }

        if (session) {
          setStatus("OZLIND COMPONENT WORKS — LOGGED IN");
        } else {
          setStatus("OZLIND COMPONENT WORKS — NO SESSION");
        }
      } catch (error) {
        if (!mounted) return;

        setStatus("OZLIND COMPONENT WORKS — AUTH CHECK FAILED");
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#ff0000",
        color: "#ffffff",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "520px",
          textAlign: "center",
          padding: "32px 24px",
          borderRadius: "20px",
          background: "#111111",
          border: "2px solid rgba(255,255,255,0.25)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: "12px",
          }}
        >
          OZLIND AI
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            lineHeight: 1.15,
            fontWeight: 800,
          }}
        >
          TEST PASSED
        </h1>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: "18px",
            lineHeight: 1.5,
            color: "#ffffff",
          }}
        >
          {status}
        </p>

        <div
          style={{
            marginTop: "24px",
            padding: "14px 16px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.08)",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          app/page.jsx → OzlindApp.jsx is rendering correctly.
        </div>
      </section>
    </main>
  );
}