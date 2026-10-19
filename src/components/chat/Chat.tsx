"use client";
import { shouldFlushVisibleText } from "@/lib/chat/streaming.mjs";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { OfflineBanner } from "@/components/chat/OfflineBanner";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { usePreferences } from "@/hooks/usePreferences";
import { OzlindIcon } from "@/components/ui/OzlindIcon";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
};

type ChatMode = "auto" | "fast" | "vision" | "pro";
type ChatImage = { dataUrl: string; mimeType: "image/jpeg"; name: string };

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const toBlob = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve¶»§q«^