"use client";

import { useMemo, useState } from "react";
import { Menu, Settings2, Sun, Moon, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOzlindChat } from "@/hooks/useOzlindChat";
import Sidebar from "@/components/chat/Sidebar";
import Composer from "@/components/chat/Composer";
import MessageList from "@/components/chat/MessageList";
import SettingsPanel from "@/components/settings/SettingsPanel";

export default function OzlindWorkspace({
  initialUser,
  initialHistory,
  initialSettings,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [value, setValue] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [notice, setNotice] = useState("");

  const chat = useOzlindChat({
    initialUser,
    initialHistory,
    initialSettings,
  });

  const title = useMemo(() => {
    const lastUser = [...chat.messages].reverse().find((message) => message.role === "user");
    return lastUser?.content ? lastUser.content.slice(0, 64) : "New chat";
  }, [chat.messages]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
      setNotice("Copied");
      window.setTimeout(() => setNotice(""), 1200);
    } catch {
      setNotice("Copy failed");
      window.setTimeout(() => setNotice(""), 1200);
    }
  };

  const regenerate = () => {
    const previous = [...chat.messages].reverse().find((message) => message.role === "user");
    if (previous) chat.send(previous.content);
  };

  const logout = async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const attach = async (file) => {
    try {
      await chat.attachFile(file);
    } catch (attachError) {
      setNotice(attachError?.message || "Attachment failed");
      window.setTimeout(() => setNotice(""), 1600);
    }
  };

  return (
    <div className={"oz-v3 " + (dark ? "oz-v3-dark" : "")}>
      <Sidebar
        open={sidebarOpen}
        history={chat.history}
        activeChatId={chat.activeChatId}
        query={historyQuery}
        onQuery={setHistoryQuery}
        onNewChat={() => { chat.startNewChat(); setSidebarOpen(false); }}
        onOpen={(id) => { chat.openConversation(id); setSidebarOpen(false); }}
        onDelete={chat.removeConversation}
        onSettings={() => setSettingsOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="oz-v3-main">
        <header className="oz-v3-header">
          <div className="oz-v3-header-left">
            <button type="button" className="oz-v3-icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={19} />
            </button>
            <div>
              <strong>{title}</strong>
              <span>{chat.status || "OZLIND AI"}</span>
            </div>
          </div>

          <div className="oz-v3-header-actions">
            <button type="button" className="oz-v3-icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="oz-v3-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
              <Settings2 size={18} />
            </button>
            <button type="button" className="oz-v3-icon-button" onClick={logout} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="oz-v3-scroll">
          <MessageList
            messages={chat.messages}
            streaming={chat.streaming}
            onCopy={copy}
            onRegenerate={regenerate}
          />
        </div>

        {chat.error ? <div className="oz-v3-error" role="alert">{chat.error}</div> : null}
        {notice ? <div className="oz-v3-toast" role="status">{notice}</div> : null}

        <Composer
          value={value}
          onChange={setValue}
          onSend={(text) => { setValue(""); chat.send(text); }}
          onStop={chat.stop}
          streaming={chat.streaming}
          selectedFile={chat.selectedFile}
          onAttach={attach}
          onRemoveFile={() => chat.setSelectedFile(null)}
          research={chat.settings.research}
          onResearchChange={(research) => chat.updateSettings({ research })}
          mode={chat.mode}
          onModeChange={chat.setMode}
        />
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={chat.settings}
        onUpdate={chat.updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
