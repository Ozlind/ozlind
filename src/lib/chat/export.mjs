function cleanLine(value) {
  return String(value ?? "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHeading(value) {
  return cleanLine(value).replace(/[#*_~[\]]/g, "").slice(0, 120) || "Ozlind conversation";
}

function cleanAttachmentName(value) {
  return cleanLine(value).replace(/[[\]<>]/g, "").slice(0, 160) || "Attached image";
}

export function suggestArtifactTitle(messages, prefix = "Ozlind") {
  const firstUserMessage = messages.find((message) => message.role === "user" && cleanLine(message.content));
  const source = firstUserMessage?.content || messages.find((message) => cleanLine(message.content))?.content || "";
  const summary = cleanLine(source)
    .replace(/[#*_~]/g, "")
    .split(String.fromCharCode(96)).join("")
    .slice(0, 112)
    .trim();
  if (!summary) return (cleanHeading(prefix) + " conversation").slice(0, 160);
  return (cleanHeading(prefix) + " — " + summary).slice(0, 160);
}

export function buildConversationMarkdown(messages, title = "Ozlind conversation") {
  const safeTitle = cleanHeading(title);
  const entries = messages
    .filter((message) => cleanLine(message.content) || (message.images && message.images.length))
    .map((message) => {
      const heading = message.role === "user" ? "You" : "Ozlind";
      const body = String(message.content ?? "").trim();
      const attachments = (message.images ?? [])
        .map((image) => cleanAttachmentName(image.name))
        .filter(Boolean);
      const attachmentLine = attachments.length
        ? "\n\n_Attached images: " + attachments.join(", ") + "_"
        : "";
      return "## " + heading + "\n\n" + (body || "_Image attached._") + attachmentLine;
    });

  return "# " + safeTitle + "\n\nExported from Ozlind on " + new Date().toISOString() +
    "\n\n---\n\n" + (entries.length ? entries.join("\n\n---\n\n") : "_This conversation is empty._") + "\n";
}
