export const messages = {
  en: {
    settings:"Settings", back:"Back to chat", appearance:"Appearance", chat:"Chat", developer:"Developer",
    theme:"Theme", accent:"Accent", density:"Density", layout:"Layout", language:"Language", defaultModel:"Default model",
    enterToSend:"Enter to send", autoScroll:"Auto-scroll", showReasoning:"Show reasoning", system:"System", light:"Light", dark:"Dark",
    compact:"Compact", comfortable:"Comfortable", spacious:"Spacious", standard:"Standard", wide:"Wide",
    loading:"Loading settings…", saving:"Saving…", newChat:"New chat", conversation:"Conversation", workspace:"Workspace",
    howCanIHelp:"How can I help?", ask:"Ask a question, draft something, or work through a problem.",
    plan:"Plan my week", explain:"Explain an idea", write:"Write with me", message:"Message Ozlind…",
  },
  ml: {
    settings:"ക്രമീകരണങ്ങൾ", back:"ചാറ്റിലേക്ക് മടങ്ങുക", appearance:"രൂപഭാവം", chat:"ചാറ്റ്", developer:"ഡെവലപ്പർ",
    theme:"തീം", accent:"ആക്സന്റ്", density:"ഡെൻസിറ്റി", layout:"ലേയൗട്ട്", language:"ഭാഷ", defaultModel:"ഡീഫോൾട്ട് മോഡൽ",
    enterToSend:"Enter ഉപയോഗിച്ച് അയയ്ക്കുക", autoScroll:"ഓട്ടോ-സ്ക്രോൾ", showReasoning:"Reasoning കാണിക്കുക", system:"സിസ്റ്റം", light:"ലൈറ്റ്", dark:"ഡാർക്ക്",
    compact:"കോംപാക്റ്റ്", comfortable:"കമ്ഫർട്ടബിൾ", spacious:"സ്പേഷ്യസ്", standard:"സ്റ്റാൻഡേർഡ്", wide:"വൈഡ്",
    loading:"ക്രമീകരണങ്ങൾ ലോഡ് ചെയ്യുന്നു…", saving:"സേവ് ചെയ്യുന്നു…", newChat:"പുതിയ ചാറ്റ്", conversation:"സംഭാഷണം", workspace:"വർക്ക്‌സ്‌പേസ്",
    howCanIHelp:"എങ്ങനെ സഹായിക്കാം?", ask:"ഒരു ചോദ്യം ചോദിക്കൂ, എന്തെങ്കിലും എഴുതൂ, അല്ലെങ്കിൽ ഒരു പ്രശ്നം പരിഹരിക്കാം.",
    plan:"എന്റെ ആഴ്ച പ്ലാൻ ചെയ്യൂ", explain:"ഒരു ആശയം ലളിതമായി വിശദീകരിക്കൂ", write:"എന്നോടൊപ്പം എഴുതൂ", message:"Ozlind-നോട് ചോദിക്കൂ…",
  },
} as const;

export type Language = keyof typeof messages;
export type MessageKey = keyof typeof messages.en;

export function t(language: Language, key: MessageKey) {
  return messages[language][key];
}
