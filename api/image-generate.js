// OZLIND AI — In-chat image generation endpoint
// Provider: Pollinations
//
// The frontend never talks to the provider directly for generation control.
// This route validates the request and keeps provider details behind OZLIND's API.

const ALLOWED_MODELS = new Set(["flux", "turbo"]);
const ALLOWED_SIZES = new Set([
  "512x512",
  "768x768",
  "1024x1024",
  "1024x768",
  "768x1024",
  "1536x1024",
  "1024x1536"
]);

function cleanPrompt(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function int(value,fallback){
  const n=Number.parseInt(value,10);
  return Number.isFinite(n)?n:fallback;
}

function validSize(width,height){
  return ALLOWED_SIZES.has(`${width}x${height}`);
}

export default async function handler(req,res){
  if(req.method!=="POST"){
    res.setHeader("Allow","POST");
    return res.status(405).json({error:"Method not allowed"});
  }

  try{
    const body=req.body&&typeof req.body==="object"?req.body:{};
    const prompt=cleanPrompt(body.prompt);

    if(!prompt)
      return res.status(400).json({error:"Describe the image you want OZLIND to create."});

    if(prompt.length>1200)
      return res.status(400).json({error:"Image prompt is too long. Keep it under 1200 characters."});

    let width=int(body.width,1024);
    let height=int(body.height,1024);

    if(!validSize(width,height)){
      width=1024;
      height=1024;
    }

    const model=ALLOWED_MODELS.has(String(body.model))
      ? String(body.model)
      : "flux";

    const seed=Math.floor(Math.random()*1000000000);
    const encoded=encodeURIComponent(prompt);

    const imageUrl=
      `https://image.pollinations.ai/prompt/${encoded}`+
      `?width=${width}`+
      `&height=${height}`+
      `&model=${encodeURIComponent(model)}`+
      `&seed=${seed}`+
      `&nologo=true`;

    return res.status(200).json({
      success:true,
      imageUrl,
      prompt,
      width,
      height,
      model
    });
  }catch(error){
    console.error("OZLIND image generation error:",error);
    return res.status(500).json({
      error:"OZLIND could not create the image right now. Please try again."
    });
  }
}