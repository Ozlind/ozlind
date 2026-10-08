"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Paperclip, Square, X } from "lucide-react";

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  selectedFile,
  onAttach,
  onRemoveFile,
  research,
  onResearchChange,
  mode,
  onModeChange,
}) {
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 180) + "px";
  }, [value]);

  const submit = () => {
    if (streaming) return onStop();
    const text = value.trim();
    if (!text && !selectedFile) return;
    onSend(text);
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const toggleVoice = () => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    if (listening) {
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((item) => item[0]?.transcript || "")
        .join("");
      onChange(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    setListening(true);
  };

  return (
    <div className="oz-v3-composer-wrap">
      {selectedFile ? (
        <div className="oz-v3-file-preview">
          <div>
            <strong>{selectedFile.name}</strong>
            <span>{Math.ceil((selectedFile.size || 0) / 1024)} KB</span>
          </div>
          <button type="button" onClick={onRemoveFile} aria-label="Remove attachment">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="oz-v3-composer">
        <button
          type="button"
          className="oz-v3-icon-button"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a file"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css"
          onChange={(event) => {
            onAttach(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message OZLIND…"
          aria-label="Message OZLIND"
        />

        <button
          type="button"
          className={"oz-v3-icon-button " + (listening ? "is-active" : "")}
          onClick={toggleVoice}
          aria-label="Voice input"
        >
          <Mic size={18} />
        </button>

        <button
          type="button"
          className="oz-v3-send"
          onClick={submit}
          aria-label={streaming ? "Stop generation" : "Send message"}
        >
          {streaming ? <Square size={14} fill="currentColor" /> : <ArrowUp size={18} />}
        </button>
      </div>

      <div className="oz-v3-composer-meta">
        <button type="button" onClick={() => onModeChange(mode === "pro" ? "auto" : "pro")}>
          {mode === "pro" ? "Pro mode" : "Auto mode"}
        </button>
        <button type="button" className={research ? "is-on" : ""} onClick={() => onResearchChange(!research)}>
          {research ? "Live research on" : "Live research"}
        </button>
        <span>OZLIND can make mistakes. Verify important information.</span>
      </div>
    </div>
  );
}
