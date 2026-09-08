/* =========================================================
   OZLIND — image-editor.js
   Browser Canvas Image Editor
   ========================================================= */

(() => {
  "use strict";

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_DIMENSION = 1800;
  const MAX_HISTORY = 30;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const upload = $("#editorUpload");
  const chooseButton = $("#editorChooseBtn");
  const dropzone = $("#dropzone");
  const fileInput = $("#editorFileInput");
  const workspace = $("#editorWorkspace");

  const canvas = $("#editorCanvas");
  const ctx = canvas?.getContext("2d", {
    willReadFrequently: true
  });

  if (!canvas || !ctx) return;

  const canvasWrap = $("#canvasWrap");

  let sourceCanvas = document.createElement("canvas");
  let sourceCtx = sourceCanvas.getContext("2d");

  let originalDataURL = "";
  let history = [];
  let historyIndex = -1;

  let zoom = 1;

  let state = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    vignette: 0,
    blur: 0,
    sharpen: 0,
    filter: "none",
    rotation: 0,
    flipH: false,
    flipV: false,
    straighten: 0
  };

  let drawTool = "brush";
  let brushColor = "#ffffff";
  let brushSize = 8;

  let drawing = false;
  let drawStart = null;

  let cropRatio = null;

  /* =========================
     UTILITIES
  ========================== */

  function toast(message, error = false) {
    if (window.ozlindToast) {
      window.ozlindToast(message, error);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resetState() {
    state = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      vignette: 0,
      blur: 0,
      sharpen: 0,
      filter: "none",
      rotation: 0,
      flipH: false,
      flipV: false,
      straighten: 0
    };

    $$("[data-adjust]").forEach((input) => {
      input.value = "0";
      updateSliderValue(input);
    });

    const straighten = $("#straightenSlider");

    if (straighten) {
      straighten.value = "0";
      updateSliderValue(straighten);
    }

    $$(".filter-swatch").forEach((item) => {
      item.classList.toggle(
        "is-active",
        item.dataset.filter === "none"
      );
    });
  }

  function updateSliderValue(input) {
    const output = $(
      `[data-for="${input.id || input.dataset.adjust}"]`
    );

    if (output) {
      const suffix =
        input.id === "straightenSlider" ? "°" : "";

      output.textContent =
        `${input.value}${suffix}`;
    }
  }

  function fitDimensions(width, height) {
    const scale =
      Math.min(
        1,
        MAX_DIMENSION / Math.max(width, height)
      );

    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Please choose a valid image."));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        reject(new Error("Image must be 25 MB or smaller."));
        return;
      }

      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The image could not be loaded."));
      };

      image.src = url;
    });
  }

  /* =========================
     IMAGE LOAD
  ========================== */

  async function loadFile(file) {
    try {
      const image = await createImageFromFile(file);

      const dimensions = fitDimensions(
        image.naturalWidth,
        image.naturalHeight
      );

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      sourceCanvas.width = dimensions.width;
      sourceCanvas.height = dimensions.height;

      sourceCtx.clearRect(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );

      sourceCtx.drawImage(
        image,
        0,
        0,
        dimensions.width,
        dimensions.height
      );

      originalDataURL = sourceCanvas.toDataURL("image/png");

      resetState();

      history = [];
      historyIndex = -1;

      commitHistory();

      upload.hidden = true;
      workspace.hidden = false;

      setZoom(1);
      render();

      toast("Image loaded.");
    } catch (error) {
      toast(
        error?.message || "Unable to load image.",
        true
      );
    }
  }

  chooseButton?.addEventListener("click", () => {
    fileInput.click();
  });

  dropzone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (file) {
      loadFile(file);
    }

    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone?.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];

    if (file) {
      loadFile(file);
    }
  });

  /* =========================
     RENDER
  ========================== */

  function filterString() {
    const brightness =
      100 + state.brightness;

    const contrast =
      100 + state.contrast;

    const saturation =
      100 + state.saturation;

    const exposure =
      Math.pow(2, state.exposure / 100);

    const blur =
      Math.max(0, state.blur);

    let filter = `
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
    `;

    if (exposure !== 1) {
      filter += ` brightness(${exposure})`;
    }

    if (blur > 0) {
      filter += ` blur(${blur}px)`;
    }

    switch (state.filter) {
      case "mono":
        filter += " grayscale(1)";
        break;

      case "sepia":
        filter += " sepia(.9)";
        break;

      case "cinematic":
        filter += " contrast(1.16) saturate(.82)";
        break;

      case "warm":
        filter += " sepia(.18) saturate(1.18)";
        break;

      case "cool":
        filter += " hue-rotate(12deg) saturate(.9)";
        break;

      case "vintage":
        filter += " sepia(.35) contrast(.9) saturate(.85)";
        break;

      case "vivid":
        filter += " saturate(1.5) contrast(1.08)";
        break;
    }

    return filter;
  }

  function render() {
    if (!sourceCanvas.width || !sourceCanvas.height) return;

    const radians =
      (state.rotation + state.straighten) *
      Math.PI /
      180;

    const swap =
      Math.abs(
        ((state.rotation % 360) + 360) % 360
      ) === 90;

    const outputWidth =
      swap
        ? sourceCanvas.height
        : sourceCanvas.width;

    const outputHeight =
      swap
        ? sourceCanvas.width
        : sourceCanvas.height;

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.save();

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.translate(
      canvas.width / 2,
      canvas.height / 2
    );

    ctx.rotate(radians);

    ctx.scale(
      state.flipH ? -1 : 1,
      state.flipV ? -1 : 1
    );

    ctx.filter = filterString();

    ctx.drawImage(
      sourceCanvas,
      -sourceCanvas.width / 2,
      -sourceCanvas.height / 2
    );

    ctx.filter = "none";

    ctx.restore();

    if (state.temperature !== 0) {
      applyTemperature();
    }

    if (state.vignette > 0) {
      applyVignette();
    }

    if (state.sharpen > 0) {
      applySharpen();
    }

    updateCanvasSize();
  }

  function applyTemperature() {
    const amount =
      state.temperature / 100;

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const data = imageData.data;

    const redShift =
      amount > 0 ? amount * 24 : amount * 10;

    const blueShift =
      amount > 0 ? amount * -18 : amount * -30;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(data[i] + redShift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + blueShift, 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function applyVignette() {
    const amount = state.vignette / 100;

    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * .18,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * .72
    );

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      `rgba(0,0,0,${.75 * amount})`
    );

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
    ctx.restore();
  }

  function applySharpen() {
    const amount = state.sharpen / 100;

    if (amount <= 0) return;

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const src = imageData.data;
    const copy = new Uint8ClampedArray(src);

    const w = canvas.width;
    const h = canvas.height;

    const strength = amount * .65;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const index = (y * w + x) * 4;

        for (let channel = 0; channel < 3; channel++) {
          const center = copy[index + channel];

          const north =
            copy[((y - 1) * w + x) * 4 + channel];

          const south =
            copy[((y + 1) * w + x) * 4 + channel];

          const west =
            copy[(y * w + x - 1) * 4 + channel];

          const east =
            copy[(y * w + x + 1) * 4 + channel];

          const sharpened =
            center * (1 + 4 * strength) -
            (north + south + west + east) * strength;

          src[index + channel] =
            clamp(sharpened, 0, 255);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function updateCanvasSize() {
    canvas.style.width =
      `${canvas.width * zoom}px`;

    canvas.style.height =
      `${canvas.height * zoom}px`;
  }

  /* =========================
     HISTORY
  ========================== */

  function commitHistory() {
    if (!canvas.width || !canvas.height) return;

    const snapshot = canvas.toDataURL("image/png");

    if (
      history[historyIndex] === snapshot
    ) {
      updateHistoryButtons();
      return;
    }

    history =
      history.slice(0, historyIndex + 1);

    history.push(snapshot);

    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    historyIndex =
      history.length - 1;

    updateHistoryButtons();
  }

  function restoreSnapshot(dataURL) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.drawImage(image, 0, 0);

        updateCanvasSize();

        resolve();
      };

      image.onerror = () =>
        reject(new Error("Could not restore edit."));

      image.src = dataURL;
    });
  }

  async function undo() {
    if (historyIndex <= 0) return;

    historyIndex--;

    await restoreSnapshot(
      history[historyIndex]
    );

    updateHistoryButtons();
  }

  async function redo() {
    if (historyIndex >= history.length - 1) return;

    historyIndex++;

    await restoreSnapshot(
      history[historyIndex]
    );

    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    $("#undoBtn").disabled =
      historyIndex <= 0;

    $("#redoBtn").disabled =
      historyIndex >= history.length - 1;
  }

  $("#undoBtn")?.addEventListener("click", undo);
  $("#redoBtn")?.addEventListener("click", redo);

  /* =========================
     RESET / BEFORE AFTER
  ========================== */

  $("#resetBtn")?.addEventListener("click", async () => {
    if (!originalDataURL) return;

    await restoreSnapshot(originalDataURL);

    resetState();

    history = [originalDataURL];
    historyIndex = 0;

    updateHistoryButtons();
    updateCanvasSize();

    toast("Image reset.");
  });

  let showingBefore = false;

  $("#beforeAfterBtn")?.addEventListener("pointerdown", async () => {
    if (!originalDataURL || showingBefore) return;

    showingBefore = true;

    try {
      await restoreSnapshot(originalDataURL);
    } catch {
      showingBefore = false;
    }
  });

  const stopBeforeAfter = async () => {
    if (!showingBefore) return;

    showingBefore = false;

    if (history[historyIndex]) {
      await restoreSnapshot(
        history[historyIndex]
      );
    }
  };

  $("#beforeAfterBtn")?.addEventListener(
    "pointerup",
    stopBeforeAfter
  );

  $("#beforeAfterBtn")?.addEventListener(
    "pointerleave",
    stopBeforeAfter
  );

  /* =========================
     ROTATE / FLIP
  ========================== */

  $("#rotateLeftBtn")?.addEventListener("click", () => {
    state.rotation -= 90;
    render();
    commitHistory();
  });

  $("#rotateRightBtn")?.addEventListener("click", () => {
    state.rotation += 90;
    render();
    commitHistory();
  });

  $("#flipHBtn")?.addEventListener("click", () => {
    state.flipH = !state.flipH;
    render();
    commitHistory();
  });

  $("#flipVBtn")?.addEventListener("click", () => {
    state.flipV = !state.flipV;
    render();
    commitHistory();
  });

  /* =========================
     TABS
  ========================== */

  $$(".etab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;

      $$(".etab").forEach((item) => {
        item.classList.toggle(
          "is-active",
          item === tab
        );

        item.setAttribute(
          "aria-selected",
          String(item === tab)
        );
      });

      $$(".etab-panel").forEach((panel) => {
        const active =
          panel.dataset.panel === name;

        panel.hidden = !active;
        panel.classList.toggle(
          "is-active",
          active
        );
      });
    });
  });

  /* =========================
     ADJUSTMENTS
  ========================== */

  $$("[data-adjust]").forEach((input) => {
    updateSliderValue(input);

    input.addEventListener("input", () => {
      const key = input.dataset.adjust;

      state[key] = Number(input.value);

      updateSliderValue(input);
      render();
    });

    input.addEventListener("change", commitHistory);
  });

  $("#straightenSlider")?.addEventListener("input", (event) => {
    state.straighten =
      Number(event.target.value);

    updateSliderValue(event.target);
    render();
  });

  $("#straightenSlider")?.addEventListener(
    "change",
    commitHistory
  );

  /* =========================
     FILTERS
  ========================== */

  $$(".filter-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter =
        button.dataset.filter || "none";

      $$(".filter-swatch").forEach((item) => {
        item.classList.toggle(
          "is-active",
          item === button
        );
      });

      render();
      commitHistory();
    });
  });

  /* =========================
     ZOOM
  ========================== */

  function setZoom(value) {
    zoom = clamp(value, .25, 3);
    $("#zoomLabel").textContent =
      `${Math.round(zoom * 100)}%`;

    updateCanvasSize();
  }

  $("#zoomOutBtn")?.addEventListener(
    "click",
    () => setZoom(zoom - .1)
  );

  $("#zoomInBtn")?.addEventListener(
    "click",
    () => setZoom(zoom + .1)
  );

  /* =========================
     FULLSCREEN
  ========================== */

  $("#fullscreenBtn")?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await canvasWrap.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast("Fullscreen is not available.", true);
    }
  });

  /* =========================
     DRAWING
  ========================== */

  $("#drawToolGroup")?.addEventListener("click", (event) => {
    const button =
      event.target.closest("[data-draw-tool]");

    if (!button) return;

    drawTool =
      button.dataset.drawTool || "brush";

    $$("#drawToolGroup button").forEach((item) => {
      item.classList.toggle(
        "is-active",
        item === button
      );
    });
  });

  $("#brushColor")?.addEventListener("input", (event) => {
    brushColor = event.target.value;
  });

  $("#brushSize")?.addEventListener("input", (event) => {
    brushSize = Number(event.target.value);

    $("#brushSizeVal").textContent =
      String(brushSize);
  });

  function pointerPosition(event) {
    const rect =
      canvas.getBoundingClientRect();

    const scaleX =
      canvas.width / rect.width;

    const scaleY =
      canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function drawStartHandler(event) {
    if (
      !workspace ||
      workspace.hidden
    ) return;

    const activePanel =
      $(".etab-panel.is-active");

    if (
      !activePanel ||
      activePanel.dataset.panel !== "draw"
    ) return;

    event.preventDefault();

    drawing = true;
    drawStart = pointerPosition(event);

    canvas.setPointerCapture?.(event.pointerId);

    if (
      drawTool === "brush" ||
      drawTool === "eraser"
    ) {
      ctx.save();

      ctx.globalCompositeOperation =
        drawTool === "eraser"
          ? "destination-out"
          : "source-over";

      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(
        drawStart.x,
        drawStart.y
      );
    }
  }

  function drawMoveHandler(event) {
    if (!drawing) return;

    event.preventDefault();

    const point = pointerPosition(event);

    if (
      drawTool === "brush" ||
      drawTool === "eraser"
    ) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      return;
    }

    restoreCurrentHistorySnapshot();

    ctx.save();

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";

    if (drawTool === "line") {
      ctx.beginPath();
      ctx.moveTo(
        drawStart.x,
        drawStart.y
      );
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    if (drawTool === "rect") {
      ctx.strokeRect(
        drawStart.x,
        drawStart.y,
        point.x - drawStart.x,
        point.y - drawStart.y
      );
    }

    if (drawTool === "circle") {
      const dx =
        point.x - drawStart.x;

      const dy =
        point.y - drawStart.y;

      const radius =
        Math.sqrt(dx * dx + dy * dy);

      ctx.beginPath();

      ctx.arc(
        drawStart.x,
        drawStart.y,
        radius,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEndHandler(event) {
    if (!drawing) return;

    drawing = false;

    try {
      ctx.restore();
    } catch {
      // No saved drawing context.
    }

    canvas.releasePointerCapture?.(
      event.pointerId
    );

    commitHistory();
  }

  function restoreCurrentHistorySnapshot() {
    const current =
      history[historyIndex];

    if (!current) return;

    const image = new Image();

    image.onload = () => {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    image.src = current;
  }

  canvas.addEventListener(
    "pointerdown",
    drawStartHandler,
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    drawMoveHandler,
    { passive: false }
  );

  canvas.addEventListener(
    "pointerup",
    drawEndHandler,
    { passive: false }
  );

  canvas.addEventListener(
    "pointercancel",
    drawEndHandler,
    { passive: false }
  );

  /* =========================
     TEXT
  ========================== */

  $("#textSize")?.addEventListener("input", (event) => {
    $("#textSizeVal").textContent =
      event.target.value;
  });

  $("#addTextBtn")?.addEventListener("click", () => {
    const text =
      $("#textInput")?.value.trim();

    if (!text) {
      toast("Enter some text first.", true);
      return;
    }

    const size =
      Number($("#textSize")?.value || 48);

    const color =
      $("#textColor")?.value || "#ffffff";

    ctx.save();

    ctx.fillStyle = color;
    ctx.font =
      `600 ${size}px Inter, system-ui, sans-serif`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines =
      text.split(/\r?\n/);

    const lineHeight =
      size * 1.2;

    const centerX =
      canvas.width / 2;

    const centerY =
      canvas.height / 2 -
      ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        centerX,
        centerY + index * lineHeight
      );
    });

    ctx.restore();

    commitHistory();

    $("#textInput").value = "";

    toast("Text added.");
  });

  /* =========================
     CROP
  ========================== */

  $("#aspectGroup")?.addEventListener("click", (event) => {
    const button =
      event.target.closest("[data-aspect]");

    if (!button) return;

    const aspect =
      button.dataset.aspect;

    cropRatio =
      aspect === "free"
        ? null
        : parseAspect(aspect);

    $$("#aspectGroup button").forEach((item) => {
      item.classList.toggle(
        "is-active",
        item === button
      );
    });

    showCropOverlay();
  });

  function parseAspect(value) {
    const [a, b] =
      value.split(":").map(Number);

    if (!a || !b) return null;

    return a / b;
  }

  function showCropOverlay() {
    const box = $("#cropBox");

    if (!box || !canvas.width) return;

    const rect =
      canvas.getBoundingClientRect();

    const wrapRect =
      canvasWrap.getBoundingClientRect();

    const width = rect.width * .8;
    const height =
      cropRatio
        ? width / cropRatio
        : rect.height * .8;

    const finalWidth =
      Math.min(width, rect.width * .9);

    const finalHeight =
      cropRatio
        ? Math.min(height, rect.height * .9)
        : Math.min(rect.height * .8, height);

    box.hidden = false;

    box.style.width =
      `${finalWidth}px`;

    box.style.height =
      `${finalHeight}px`;

    box.style.left =
      `${(wrapRect.width - finalWidth) / 2}px`;

    box.style.top =
      `${(wrapRect.height - finalHeight) / 2}px`;
  }

  $("#applyCropBtn")?.addEventListener("click", () => {
    const box = $("#cropBox");

    if (!box || box.hidden) {
      showCropOverlay();
      return;
    }

    const canvasRect =
      canvas.getBoundingClientRect();

    const boxRect =
      box.getBoundingClientRect();

    let x =
      (boxRect.left - canvasRect.left) /
      canvasRect.width *
      canvas.width;

    let y =
      (boxRect.top - canvasRect.top) /
      canvasRect.height *
      canvas.height;

    let width =
      boxRect.width /
      canvasRect.width *
      canvas.width;

    let height =
      boxRect.height /
      canvasRect.height *
      canvas.height;

    x = clamp(x, 0, canvas.width);
    y = clamp(y, 0, canvas.height);

    width =
      clamp(width, 1, canvas.width - x);

    height =
      clamp(height, 1, canvas.height - y);

    const cropped =
      document.createElement("canvas");

    cropped.width =
      Math.round(width);

    cropped.height =
      Math.round(height);

    const cropCtx =
      cropped.getContext("2d");

    cropCtx.drawImage(
      canvas,
      x,
      y,
      width,
      height,
      0,
      0,
      cropped.width,
      cropped.height
    );

    sourceCanvas.width =
      cropped.width;

    sourceCanvas.height =
      cropped.height;

    sourceCtx.clearRect(
      0,
      0,
      cropped.width,
      cropped.height
    );

    sourceCtx.drawImage(
      cropped,
      0,
      0
    );

    resetState();

    render();

    $("#cropBox").hidden = true;

    commitHistory();

    toast("Crop applied.");
  });

  /* =========================
     EXPORT
  ========================== */

  $("#downloadBtn")?.addEventListener(
    "click",
    async () => {
      if (!canvas.width) {
        toast("Load an image first.", true);
        return;
      }

      const format =
        $("#exportFormat")?.value ||
        "image/png";

      const quality =
        Number(
          $("#exportQuality")?.value || .95
        );

      try {
        const blob =
          await new Promise((resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) resolve(result);
                else reject(
                  new Error("Export failed.")
                );
              },
              format,
              quality
            );
          });

        const extension =
          format === "image/jpeg"
            ? "jpg"
            : format === "image/webp"
              ? "webp"
              : "png";

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download =
          `ozlind-edit-${Date.now()}.${extension}`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        toast("Image exported.");
      } catch (error) {
        toast(
          error?.message || "Export failed.",
          true
        );
      }
    }
  );

})();
