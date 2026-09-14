"use client";

import { useEffect } from "react";

const markup = `

  <div class="ozlind-boot" id="ozlindBoot" role="status" aria-label="OZLIND AI loading">
    <div class="boot-inner">
      <div class="boot-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
      <div class="boot-name">OZLIND</div>
      <div class="boot-subtitle">AI PLATFORM</div>
      <div class="boot-dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  </div>

  <!-- Exact OZLIND identity sprite. Runtime uses local <use> references for reliable mobile rendering. -->
  <div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="OZLIND navigation">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
        <div class="brand-copy"><strong>OZLIND</strong><span>AI WORKSPACE</span></div>
      </div>

      <button class="btn btn-primary new-chat" id="newChatBtn" type="button">
        <svg class="ui-icon"><use href="/ozlind-icons.svg#i-new-conversation"></use></svg>
        <span>New chat</span>
      </button>

      <nav class="nav" aria-label="Workspace">
        <div class="nav-section-label">WORKSPACE</div>
        <button class="nav-item active" data-view="chat" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-ai-chat"></use></svg><span>Chat</span><em>LIVE</em>
        </button>
        <button class="nav-item" data-view="history" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-history"></use></svg><span>History</span>
        </button>

        <div class="nav-section-label">AI TOOLS</div>
        <button class="nav-item" data-view="research" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-web-research"></use></svg><span>Web Research</span><em>LIVE</em>
        </button>
        <button class="nav-item disabled-tool" data-view="photo" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-photo-editor"></use></svg><span>Photo Editor</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="code" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-code-assistant"></use></svg><span>Code Assistant</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="documents" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-documents"></use></svg><span>Documents</span><em>NEXT</em>
        </button>
        <button class="nav-item disabled-tool" data-view="voice" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-voice-ai"></use></svg><span>Voice AI</span><em>NEXT</em>
        </button>

        <div class="nav-section-label">PERSONAL</div>
        <button class="nav-item" data-view="settings" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg><span>Settings</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <button class="profile" id="profileBtn" type="button">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-profile"></use></svg>
          <span><b>Athul</b><small>OZLIND User</small></span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <main class="main">
      <header class="topbar">
        <button class="icon-btn mobile-only" id="mobileNavBtn" type="button" aria-label="Open menu">
          <svg class="ui-icon"><use href="/ozlind-icons.svg#i-menu"></use></svg>
        </button>
        <div class="topbar-title" id="topbarTitle">AI Chat</div>
        <div class="top-actions">
          <span class="connection" id="connectionStatus"><i></i><span>Ready</span></span>
          <button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme" title="Toggle theme">
            <svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg>
          </button>
        </div>
      </header>

      <section class="page active" data-page="chat">
        <div class="chat-head">
          <div class="hero-copy">
            <div class="eyebrow">PRIVATE AI WORKSPACE</div>
            <h1><span>How can I</span><strong>help?</strong></h1>
            <p>Clear answers, focused research and intelligent conversation.</p>
          </div>

          <div class="chat-controls">
            <div class="control-group">
              <span class="control-label">Model</span>
              <button class="model-picker" id="modelPicker" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="model-picker-main"><strong id="modelPickerTitle">Auto</strong><small id="modelPickerDescription">Recommended routing</small></span>
                <svg class="ui-icon"><use href="/ozlind-icons.svg#i-forward"></use></svg>
              </button>
              <select id="modelSelect" class="native-select-fallback" aria-hidden="true" tabindex="-1">
                <option value="auto">Auto</option>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
                <option value="experiential">Experiential</option>
              </select>
              <div class="model-menu" id="modelMenu" role="listbox" aria-label="Select model">
                <button type="button" role="option" data-model="auto" aria-selected="true"><span><b>Auto</b><small>Recommended routing</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="groq" aria-selected="false"><span><b>Groq</b><small>Fast text generation</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="gemini" aria-selected="false"><span><b>Gemini</b><small>Multimodal and vision</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
                <button type="button" role="option" data-model="experiential" aria-selected="false"><span><b>Experiential</b><small>Alternative provider</small></span><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg></button>
              </div>
            </div>

            <button class="pill" id="researchToggle" type="button" aria-pressed="false">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-web-research"></use></svg><span>Research</span><strong>OFF</strong>
            </button>
          </div>
        </div>

        <div class="messages-wrap" id="messagesWrap">
          <div id="chatEmpty" class="empty-state">
            <div class="empty-mark" aria-hidden="true"><svg class="brand-logo"><use href="/ozlind-icons.svg#ozl-mark"></use></svg></div>
            <div class="empty-kicker">OZLIND AI</div>
            <h2>Start a conversation</h2>
            <p>Ask a question, explore an idea, or work through a problem.</p>
            <div class="suggestions">
              <button data-prompt="Explain something simply." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-insight"></use></svg><span>Explain something</span></button>
              <button data-prompt="Help me plan something." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-discovery"></use></svg><span>Plan something</span></button>
              <button data-prompt="Write a clean JavaScript function for me." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-code-assistant"></use></svg><span>Write code</span></button>
              <button data-prompt="Create an image of a cinematic Kerala landscape at golden hour." type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-image-generator"></use></svg><span>Create an image</span></button>
            </div>
          </div>
          <div id="chatMessages" class="messages" aria-live="polite"></div>
        </div>

        <form class="composer" id="chatForm" autocomplete="off">
          <div id="chatAttachments" class="attachments" aria-live="polite"></div>
          <div class="composer-row">
            <button type="button" class="composer-icon" id="attachBtn" aria-label="Attach image" title="Attach image">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-attach"></use></svg>
            </button>
            <input id="fileInput" type="file" accept="image/*" hidden>
            <textarea id="chatInput" rows="1" maxlength="12000" placeholder="Message OZLIND…" autocomplete="off" aria-label="Message OZLIND"></textarea>
            <button type="button" class="composer-icon voice-disabled" id="voiceBtn" aria-label="Voice input (coming soon)" title="Voice AI — NEXT">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-microphone"></use></svg>
            </button>
            <button type="submit" class="send-btn" id="sendBtn" aria-label="Send message" title="Send">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-arrow-up"></use></svg>
            </button>
            <button type="button" class="send-btn stop hidden" id="stopBtn" aria-label="Stop generation" title="Stop">
              <svg class="ui-icon"><use href="/ozlind-icons.svg#i-stop"></use></svg>
            </button>
          </div>
          <div class="composer-footer">
            <span id="contextIndicator"></span>
            <span>Enter to send · Shift + Enter for new line</span>
          </div>
        </form>
      </section>

      <section class="page" data-page="history">
        <div class="page-head"><div><div class="eyebrow">PERSONAL</div><h2>Conversation history</h2><p>Your conversations stay in this browser.</p></div></div>
        <div class="search-wrap"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-search"></use></svg><input class="search" id="conversationSearch" placeholder="Search conversations…" aria-label="Search conversations"></div>
        <div id="conversationList" class="history-list"></div>
      </section>

      <section class="page" data-page="research">
        <div class="page-head"><div><div class="eyebrow">LIVE SOURCES</div><h2>Web Research</h2><p>Research current information when freshness matters.</p></div><button class="btn btn-primary" data-focus-chat type="button">Open chat</button></div>
        <div class="info-card"><div class="card-icon"><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-research"></use></svg></div><div><b>Source-aware research</b><p>OZLIND can search the web through Tavily on the server, then synthesize the returned source context. API keys never live in this page.</p></div></div>
      </section>

      <section class="page" data-page="photo"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Photo Editor</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="code"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Code Assistant</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="documents"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Documents</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>
      <section class="page" data-page="voice"><div class="page-head"><div><div class="eyebrow">AI TOOLS</div><h2>Voice AI</h2><p>Coming next.</p></div><button class="btn" data-focus-chat type="button">Back to chat</button></div></section>

      <section class="page" data-page="settings">
        <div class="page-head"><div><div class="eyebrow">PERSONAL</div><h2>Settings</h2><p>Control response behavior and local data.</p></div></div>
        <div class="settings-grid">
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">RESPONSE</span><h3>Answer preferences</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#sym-insight"></use></svg></div>
            <label class="setting-row"><span>Length</span><select id="responseLength"><option value="short">Short</option><option value="medium" selected>Medium</option><option value="long">Long</option></select></label>
            <label class="setting-row"><span>Style</span><select id="responseStyle"><option value="balanced" selected>Balanced</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="direct">Direct</option><option value="creative">Creative</option></select></label>
            <button class="switch-row" id="memoryToggle" role="switch" aria-checked="true" type="button"><span><b>Conversation memory</b><small>Use relevant messages from this conversation.</small></span><i></i></button>
          </div>
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">PREFERENCES</span><h3>Custom instructions</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#i-settings"></use></svg></div>
            <textarea id="customInstructions" maxlength="5000" placeholder="Tell OZLIND how you prefer answers…"></textarea>
            <button class="btn btn-primary" id="saveInstructionsBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-check"></use></svg><span>Save settings</span></button>
          </div>
          <div class="setting-card">
            <div class="setting-card-head"><div><span class="eyebrow">LOCAL DATA</span><h3>History controls</h3></div><svg class="ui-icon"><use href="/ozlind-icons.svg#i-history"></use></svg></div>
            <div class="button-stack">
              <button class="btn" id="exportHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-download"></use></svg><span>Export history</span></button>
              <button class="btn" id="importHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-upload"></use></svg><span>Import history</span></button>
              <button class="btn btn-danger" id="clearHistoryBtn" type="button"><svg class="ui-icon"><use href="/ozlind-icons.svg#i-delete"></use></svg><span>Clear all history</span></button>
            </div>
            <input type="file" id="historyFileInput" accept="application/json" hidden>
          </div>
        </div>
      </section>
    </main>
  </div>

  <div id="toastStack" class="toast-stack" aria-live="polite"></div>
`;

export default function Home() {
  useEffect(() => {
    const boot = document.getElementById("ozlindBoot");
    if (boot) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const delay = reduced ? 420 : 1050;
      const leave = window.setTimeout(() => {
        boot.classList.add("is-leaving");
        window.setTimeout(() => boot.remove(), 520);
      }, delay);
      const fallback = window.setTimeout(() => boot.remove(), 3000);
      return () => { window.clearTimeout(leave); window.clearTimeout(fallback); };
    }
  }, []);

  useEffect(() => {
    const existing = document.querySelector('script[data-ozlind-chatbot="true"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "/chatbot.js";
    script.defer = true;
    script.dataset.ozlindChatbot = "true";
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}
