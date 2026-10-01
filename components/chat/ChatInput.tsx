"use client";

import {
  Paperclip,
  Send,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  Button,
} from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (
    message: string,
    file?: File,
  ) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Message OZLIND...",
}: ChatInputProps) {
  const [value, setValue] =
    useState("");

  const [file, setFile] =
    useState<File | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const submit = () => {
    const message = value.trim();

    if (
      disabled ||
      (!message && !file)
    ) {
      return;
    }

    onSend(message, file ?? undefined);

    setValue("");
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selected =
      event.target.files?.[0];

    if (!selected) {
      return;
    }

    setFile(selected);
  };

  return (
    <div className="w-full px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl"
      >
        <div
          className={cn(
            "overflow-hidden rounded-2xl border",
            "border-[var(--border)]",
            "bg-[var(--surface-1)]",
            "shadow-lg",
            "focus-within:border-[var(--accent)]",
          )}
        >
          {file ? (
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-dim)]">
                {file.name}
              </span>

              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => {
                  setFile(null);

                  if (
                    fileInputRef.current
                  ) {
                    fileInputRef
                      .current
                      .value = "";
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <X
                  size={14}
                  aria-hidden="true"
                />
              </button>
            </div>
          ) : null}

          <textarea
            value={value}
            onChange={(event) =>
              setValue(event.target.value)
            }
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            maxLength={12000}
            placeholder={placeholder}
            aria-label="Message OZLIND"
            className={cn(
              "block max-h-40 min-h-12 w-full resize-none",
              "bg-transparent px-4 py-3.5",
              "text-sm leading-6 text-[var(--text)]",
              "placeholder:text-[var(--text-faint)]",
              "outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={
                  handleFileChange
                }
                accept="image/*,.txt,.md,.csv,.json,.pdf"
                disabled={disabled}
                aria-label="Attach a file"
              />

              <Button
                variant="icon"
                size="sm"
                aria-label="Attach file"
                disabled={disabled}
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <Paperclip
                  size={17}
                  aria-hidden="true"
                />
              </Button>
            </div>

            <Button
              variant="primary"
              size="sm"
              aria-label="Send message"
              disabled={
                disabled ||
                (!value.trim() &&
                  !file)
              }
              type="submit"
              className="h-9 min-h-9 w-9 rounded-xl p-0"
            >
              <Send
                size={16}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-[var(--text-faint)]">
          Enter to send · Shift + Enter
          for a new line
        </p>
      </form>
    </div>
  );
}