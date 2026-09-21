import React, { useState } from 'react';
import { User, Copy, Check, Sparkles, ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import OzlindLogo from './OzlindLogo';

export interface Attachment {
  name: string;
  type: string;
  url: string;
  base64?: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface Message {
  id?: string;
  conversation_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  sources?: Source[];
  created_at?: string;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`py-5 px-4 md:px-6 transition-colors ${
        isUser ? 'bg-[#090A0F]' : 'bg-[#0E101A] border-y border-slate-800/40'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-4 md:gap-5">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <OzlindLogo className="w-8 h-8" glow={true} />
          )}
        </div>

        {/* Message Body */}
        <div className="flex-1 overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide">
                {isUser ? 'You' : 'OZLIND AI'}
              </span>
              {!isUser && (
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-semibold">
                  Core Engine
                </span>
              )}
            </div>

            {!isUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Copy message"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Attachments Preview */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60 max-w-xs"
                >
                  {att.type?.startsWith('image/') || att.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                    <img
                      src={att.url}
                      alt={att.name || 'Attachment'}
                      className="max-h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 text-xs text-slate-300">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span className="truncate">{att.name || 'File attachment'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formatted Content */}
          <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed font-normal space-y-2">
            <ContentRenderer text={message.content} />
          </div>

          {/* Verified Citation Sources */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Verified Sources ({message.sources.length})</span>
                {sourcesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {sourcesOpen && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {message.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-[#111320] border border-slate-800 hover:border-purple-500/40 transition-colors block group"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-200 group-hover:text-purple-300 truncate">
                        <span className="truncate">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 ml-1 opacity-70" />
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {src.snippet}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentRenderer({ text }: { text: string }) {
  if (!text) return null;

  // Split markdown code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('```')) {
          const firstLineBreak = part.indexOf('\n');
          const language = part.slice(3, firstLineBreak).trim() || 'code';
          const code = part.slice(firstLineBreak + 1, -3).trim();
          return <CodeBlock key={idx} language={language} code={code} />;
        }

        return (
          <div key={idx} className="space-y-2 whitespace-pre-wrap">
            {part.split('\n').map((line, lIdx) => {
              if (line.startsWith('### ')) {
                return (
                  <h3 key={lIdx} className="text-base font-bold text-white mt-3 mb-1">
                    {line.replace('### ', '')}
                  </h3>
                );
              }
              if (line.startsWith('#### ')) {
                return (
                  <h4 key={lIdx} className="text-sm font-bold text-cyan-300 mt-2 mb-1">
                    {line.replace('#### ', '')}
                  </h4>
                );
              }
              if (line.startsWith('- ')) {
                return (
                  <li key={lIdx} className="ml-4 list-disc text-slate-300">
                    {line.replace('- ', '')}
                  </li>
                );
              }
              return (
                <p key={lIdx} className="leading-6">
                  {line}
                </p>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#0B0C15] font-mono text-xs">
      <div className="bg-[#121422] px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400">
        <span className="font-bold text-cyan-400 uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-slate-200 leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}
