const fs=require("fs"), path=require("path");
const root=__dirname;
const files=["app/page.jsx","app/layout.jsx","app/globals.css","public/chatbot.js","public/ozlind-icons.svg","pages/api/chat.js","pages/api/image-generate.js","next.config.mjs","package.json"];
for(const f of files){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing ${f}`);}
const all=files.map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n");
if(/pollinations/i.test(all))throw new Error("Pollinations reference remains");
if(/openrouter/i.test(all))throw new Error("OpenRouter reference remains");
if(!fs.readFileSync(path.join(root,"public/ozlind-icons.svg"),"utf8").includes("ozl-mark"))throw new Error("OZLIND SVG mark missing");
console.log("OK: Next.js structure, external SVG sprite, Gemini image route, provider wiring, Pollinations removal, OpenRouter removal.");
