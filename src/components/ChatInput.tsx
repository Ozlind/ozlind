import React, { useState, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Globe, 
  Square, 
  Sparkles, 
  Compass, 
  X, 
  Zap,
  Eye
} from 'lucide-react';
import { Attachment } from './ChatMessage';

interface ChatInputProps {
  onSendMessage: (data: { content: string; attachments: Attachment[] }) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  mode: string;
  setMode: (mode: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
}

export default function ChatInput({
  onSendMessage,
  isGenerating,
  onStopGeneration,
  mode,
  setMode,
  webSearchEnabled,
  setWebSearchEnabled
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isGenerating) return;

    onSendMessage({
      content: input,
      attachments
    });
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            base64: reader.result as string,
            url: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Suggestion Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1 no-scrollbar text-xs">
        <button
          onClick={() => setInput('Explain quantum computing in simple executive summary bullet points.')}
          className="shrink-0 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Quantum Computing Summary</span>
        </button>

        <button
          onClick={() => setInput('Write a high-performance TypeScript React custom hook for WebSocket connection.')}
          className="shrink-0 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>TypeScript WebSocket Hook</span>
        </button>

        <button
          onClick={() => {
            setMode('research');
            setInput('What are the top AI technological advancements in 2026?');
          }}
          className="shrink-0 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Compass className="w-3 h-3 text-purple-400" />
          <span>2026 AI Advancements</span>
        </button>
      </div>

      {/* Main Input Box */}
      <div className="relative bg-[#11131F] border border-slate-800/90 rounded-2xl p-3 shadow-2xl focus-within:border-cyan-500/50 transition-colors">
        {/* Attachment Badges */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800/60 overflow-x-auto">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="relative group shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900"
              >
                {att.type?.startsWith('image/') ? (
                  <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[10px] text-slate-400 text-center">
                    <Paperclip className="w-4 h-4 mb-0.5 text-cyan-400" />
                    <span className="truncate w-full">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(idx)}
                  className="absolute top-1 right-1 bg-black/80 hover:bg-rose-600 text-white rounded-full p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'research'
              ? 'Ask OZLIND Deep Research (searches live knowledge base & sources)...'
              : mode === 'vision'
              ? 'Upload an image and ask OZLIND Vision to inspect it...'
              : 'Message OZLIND AI... (Shift+Enter for new line)'
          }
          rows={2}
          className="w-full bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none resize-none custom-scrollbar"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Attach image or file for multimodal reasoning"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.txt,.json"
              className="hidden"
              multiple
            />

            {/* Routing Mode Picker */}
            <div className="flex items-center bg-[#090B12] p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('smart')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'smart'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Smart AI
              </button>
              <button
                type="button"
                onClick={() => setMode('research')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'research'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Research
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('vision');
                  fileInputRef.current?.click();
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  mode === 'vision'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Vision</span>
              </button>
            </div>

            {/* Live Web Search Toggle */}
            <button
              type="button"
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                webSearchEnabled
                  ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Live Web Search Citations"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Web Search</span>
            </button>
          </div>

          <div>
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl hover:bg-rose-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Square className="w-4 h-4 fill-rose-400" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  input.trim() || attachments.length > 0
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-[10px] text-slate-500 font-medium">
          OZLIND Core AI • Private & Encrypted • Created by Athul
        </span>
      </div>
    </div>
  );
}
