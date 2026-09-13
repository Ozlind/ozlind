/* OZLIND Image Generator — V1
   Frontend module. It expects the Image Generator UI IDs/classes
   documented in IMAGE-GENERATOR-INTEGRATION.md.
*/
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  const els = {
    form: $("#image-generate-form"),
    prompt: $("#image-prompt-input"),
    width: $("#image-width"),
    height: $("#image-height"),
    model: $("#image-model"),
    generate: $("#generate-btn"),
    result: $("#image-result"),
    loading: $("#image-loading"),
    error: $("#image-error"),
  };

  if (!els.form || !els.prompt || !els.generate || !els.result) return;

  let controller = null;
  let lastPrompt = "";

  const showError = (message = "") => {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.hidden = !message;
  };

  const setLoading = (loading) => {
    if (els.loading) els.loading.hidden = !loading;
    els.generate.disabled = loading;
    els.generate.setAttribute("aria-busy", String(loading));
  };

  const safeName = (value) =>
    String(value || "ozlind-image")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "ozlind-image";

  async function generateImage(prompt, options = {}) {
    if (controller) controller.abort();
    controller = new AbortController();

    showError("");
    setLoading(true);
    lastPrompt = prompt;

    try {
      const response = await fetch("/api/image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          width: options.width,
          height: options.height,
          model: options.model,
        }),
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (!response.ok || !data.success || !data.imageUrl) {
        throw new Error(data.error || "Image generation failed.");
      }

      renderResult(data.imageUrl, prompt);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("OZLIND image generation:", error);
      showError(error?.message || "Image generation failed. Please try again.");
    } finally {
      controller = null;
      setLoading(false);
    }
  }

  function renderResult(imageUrl, prompt) {
    const card = document.createElement("article");
    card.className = "image-result-card";

    card.innerHTML = `
      <div class="image-result-frame">
        <img src="${escapeHtml(imageUrl)}"
             alt="${escapeHtml(prompt)}"
             class="generated-image"
             loading="eager">
      </div>
      <div class="image-result-meta">
        <div class="image-result-prompt">${escapeHtml(prompt)}</div>
        <div class="image-result-actions">
          <button type="button" class="secondary image-action-download">
            Download
          </button>
          <button type="button" class="secondary image-action-regenerate">
            Regenerate
          </button>
        </div>
      </div>
    `;

    const image = $("img", card);
    image.addEventListener("error", () => {
      showError("The generated image could not be loaded. Please regenerate.");
    });

    $(".image-action-download", card).addEventListener("click", () =>
      downloadImage(imageUrl, prompt)
    );

    $(".image-action-regenerate", card).addEventListener("click", () =>
      generateImage(lastPrompt, readOptions())
    );

    els.result.prepend(card);
  }

  async function downloadImage(imageUrl, prompt) {
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Download failed.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${safeName(prompt)}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Cross-origin providers can reject browser-side downloads.
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  }

  function readOptions() {
    return {
      width: els.width?.value || 1024,
      height: els.height?.value || 1024,
      model: els.model?.value || "flux",
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char]));
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const prompt = els.prompt.value.trim();
    if (!prompt) {
      showError("Describe the image you want to create.");
      els.prompt.focus();
      return;
    }

    if (prompt.length > 1200) {
      showError("Keep the image prompt under 1200 characters.");
      return;
    }

    generateImage(prompt, readOptions());
  });
})();
