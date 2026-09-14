// OZLIND shared API security helpers
"use strict";
function getClientIp(req){const f=req.headers?.["x-forwarded-for"];return String((typeof f==="string"&&f.trim()?f.split(",")[0].trim():req.headers?.["x-real-ip"]||"unknown")).slice(0,128);}
function setApiHeaders(res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");}
function applyCors(req,res){const o=String(req.headers?.origin||"");const a=String(process.env.OZLIND_ALLOWED_ORIGIN||"").trim();if(a&&o===a){res.setHeader("Access-Control-Allow-Origin",a);res.setHeader("Vary","Origin");}}
function rejectUnexpectedOrigin(req,res){const a=String(process.env.OZLIND_ALLOWED_ORIGIN||"").trim();const o=String(req.headers?.origin||"");if(a&&o&&o!==a){res.status(403).json({error:"Origin not allowed."});return true;}return false;}
module.exports={getClientIp,setApiHeaders,applyCors,rejectUnexpectedOrigin};
