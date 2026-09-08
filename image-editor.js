(() => {
  "use strict";

  /* =========================================================
     OZLIND IMAGE EDITOR
     Full replacement
     Compatible with current index.html
     ========================================================= */

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_DIMENSION = 2400;
  const MAX_HISTORY = 30;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* =========================================================
     DOM
     ========================================================= */

  const fileInput = $("#editorFileInput");
  const uploadButton = $("#editorUploadBtn");
  const dropzone = $("#dropzone");
  const workspace = $("#editorWorkspace");

  const canvas = $("#editorCanvas");
  const canvasWrap = $("#canvasWrap");

  const undoButton = $("#undoBtn");
  const redoButton = $("#redoBtn");
  const beforeAfterButton = $("#beforeAfterBtn");
  const resetButton = $("#resetBtn");

  const zoomOutButton = $("#zoomOutBtn");
  const zoomInButton = $("#zoomInBtn");
  const zoomLabel = $("#zoomLabel");
  const fullscreenButton = $("#fullscreenBtn");

  const tabs = $$(".editor-tab");
  const panels = $$("[data-panel]");

  const aspectGroup = $("#aspectGroup");
  const applyCropButton = $("#applyCropBtn");

  const rotateLeftButton = $("#rotateLeftBtn");
  const rotateRightButton = $("#rotateRightBtn");
  const flipHButton = $("#flipHBtn");
  const flipVButton = $("#flipVBtn");
  const straightenSlider = $("#straightenSlider");

  const adjustControls = $$("[data-adjust]");
  const filterButtons = $$("[data-filter]");

  const drawToolGroup = $("#drawToolGroup");
  const brushColor = $("#brushColor");
  const brushSize = $("#brushSize");
  const brushSizeValue = $("#brushSizeVal");

  const textInput = $("#textInput");
  const addTextButton = $("#addTextBtn");
  const textColor = $("#textColor");
  const textSize = $("#textSize");
  const textSizeValue = $("#textSizeVal");

  const downloadButton = $("#downloadBtn");

  const cropBox = $("#cropBox");

  if (!canvas) {
    console.warn("Ozlind Image Editor: #editorCanvas not found.");
    return;
  }

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!ctx) {
    console.error("Ozlind Image Editor: Canvas context unavailable.");
    return;
  }

  /* =========================================================
     STATE
     ========================================================= */

  let hasImage = false;

  let originalCanvas = null;

  let history = [];
  let historyIndex = -1;

  let zoom = 1;

  let showingOriginal = false;

  let rotation = 0;
  let flipX = 1;
  let flipY = 1;

  let adjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    vignette: 0,
    blur: 0,
    sharpen: 0
  };

  let activeFilter = "none";

  let crop = {
    active: false,
    aspect: "free",
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };

  let cropInteraction = null;

  let draw = {
    tool: "brush",
    color: "#ffffff",
    size: 8,
    drawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  };

  let textObjects = [];

  /* =========================================================
     UTILITIES
     ========================================================= */

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toast(message, type = "info") {
    const stack = $("#toastStack");

    if (!stack) {
      console.log(message);
      return;
    }

    const el = document.createElement("div");

    el.className =
      type === "error"
        ? "toast toast--error"
        : "toast";

    el.textContent = message;

    stack.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add("toast--show");
    });

    setTimeout(() => {
      el.classList.remove("toast--show");

      setTimeout(() => {
        el.remove();
      }, 220);
    }, 3000);
  }

  function createCanvas(width, height) {
    const c = document.createElement("canvas");

    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));

    return c;
  }

  function cloneCanvas(source) {
    const target = createCanvas(
      source.width,
      source.height
    );

    const targetCtx = target.getContext("2d");

    targetCtx.drawImage(source, 0, 0);

    return target;
  }

  function fitImageSize(width, height) {
    if (
      width <= MAX_DIMENSION &&
      height <= MAX_DIMENSION
    ) {
      return {
        width,
        height
      };
    }

    const scale = Math.min(
      MAX_DIMENSION / width,
      MAX_DIMENSION / height
    );

    return {
      width: Math.max(
        1,
        Math.round(width * scale)
      ),
      height: Math.max(
        1,
        Math.round(height * scale)
      )
    };
  }

  function showWorkspace(show) {
    if (workspace) {
      workspace.hidden = !show;
    }

    if (dropzone) {
      dropzone.hidden = show;
    }
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function updateZoom() {
    if (zoomLabel) {
      zoomLabel.textContent =
        `${Math.round(zoom * 100)}%`;
    }

    if (canvasWrap) {
      canvasWrap.style.setProperty(
        "--editor-zoom",
        String(zoom)
      );
    }
  }

  function setZoom(value) {
    zoom = clamp(value, 0.25, 4);
    updateZoom();
  }

  /* =========================================================
     HISTORY
     ========================================================= */

  function snapshot() {
    if (!hasImage) {
      return null;
    }

    return {
      canvas: cloneCanvas(canvas),

      rotation,
      flipX,
      flipY,

      adjustments: {
        ...adjustments
      },

      activeFilter,

      crop: {
        ...crop
      },

      textObjects: textObjects.map((item) => ({
        ...item
      }))
    };
  }

  function saveHistory() {
    const state = snapshot();

    if (!state) return;

    history = history.slice(
      0,
      historyIndex + 1
    );

    history.push(state);

    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    historyIndex =
      history.length - 1;

    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (undoButton) {
      undoButton.disabled =
        !hasImage ||
        historyIndex <= 0;
    }

    if (redoButton) {
      redoButton.disabled =
        !hasImage ||
        historyIndex >= history.length - 1;
    }
  }

  function restoreState(state) {
    if (!state || !state.canvas) {
      return;
    }

    canvas.width =
      state.canvas.width;

    canvas.height =
      state.canvas.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      state.canvas,
      0,
      0
    );

    rotation =
      state.rotation || 0;

    flipX =
      state.flipX || 1;

    flipY =
      state.flipY || 1;

    adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      vignette: 0,
      blur: 0,
      sharpen: 0,
      ...(state.adjustments || {})
    };

    activeFilter =
      state.activeFilter || "none";

    crop = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      ...(state.crop || {})
    };

    textObjects =
      Array.isArray(state.textObjects)
        ? state.textObjects.map((item) => ({
            ...item
          }))
        : [];

    syncControls();
    updateCropBox();
    updateHistoryButtons();
  }

  function undo() {
    if (
      !hasImage ||
      historyIndex <= 0
    ) {
      return;
    }

    historyIndex--;

    restoreState(
      history[historyIndex]
    );
  }

  function redo() {
    if (
      !hasImage ||
      historyIndex >= history.length - 1
    ) {
      return;
    }

    historyIndex++;

    restoreState(
      history[historyIndex]
    );
  }

  /* =========================================================
     IMAGE LOADING
     ========================================================= */

  function validateFile(file) {
    if (!file) {
      return "No image selected.";
    }

    if (
      !file.type ||
      !file.type.startsWith("image/")
    ) {
      return "Please select a valid image.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Maximum image size is 25 MB.";
    }

    return null;
  }

  function loadFile(file) {
    const error = validateFile(file);

    if (error) {
      toast(error, "error");
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      const image =
        new Image();

      image.onload = () => {
        initializeImage(image);
      };

      image.onerror = () => {
        toast(
          "Could not load this image.",
          "error"
        );
      };

      image.src =
        reader.result;
    };

    reader.onerror = () => {
      toast(
        "Could not read the image.",
        "error"
      );
    };

    reader.readAsDataURL(file);
  }

  function initializeImage(image) {
    const size =
      fitImageSize(
        image.naturalWidth,
        image.naturalHeight
      );

    originalCanvas =
      createCanvas(
        size.width,
        size.height
      );

    const originalCtx =
      originalCanvas.getContext("2d");

    originalCtx.drawImage(
      image,
      0,
      0,
      size.width,
      size.height
    );

    canvas.width =
      size.width;

    canvas.height =
      size.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      originalCanvas,
      0,
      0
    );

    hasImage = true;
    showingOriginal = false;

    rotation = 0;
    flipX = 1;
    flipY = 1;

    adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      vignette: 0,
      blur: 0,
      sharpen: 0
    };

    activeFilter = "none";

    textObjects = [];

    crop = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width: size.width,
      height: size.height
    };

    history = [];
    historyIndex = -1;

    zoom = 1;

    showWorkspace(true);

    syncControls();
    updateZoom();
    setupCropBox();

    saveHistory();

    toast("Image loaded successfully.");
  }

  /* =========================================================
     TRANSFORM
     ========================================================= */

  function getTransformedCanvas() {
    if (!originalCanvas) {
      return null;
    }

    const angle =
      ((rotation % 360) + 360) % 360;

    const swap =
      angle === 90 ||
      angle === 270;

    const outputWidth =
      swap
        ? originalCanvas.height
        : originalCanvas.width;

    const outputHeight =
      swap
        ? originalCanvas.width
        : originalCanvas.height;

    const c =
      createCanvas(
        outputWidth,
        outputHeight
      );

    const cctx =
      c.getContext("2d");

    cctx.save();

    cctx.translate(
      outputWidth / 2,
      outputHeight / 2
    );

    cctx.rotate(
      rotation * Math.PI / 180
    );

    cctx.scale(
      flipX,
      flipY
    );

    cctx.drawImage(
      originalCanvas,
      -originalCanvas.width / 2,
      -originalCanvas.height / 2
    );

    cctx.restore();

    return c;
  }

  function getFilterValues() {
    return {
      brightness:
        100 + adjustments.brightness,

      contrast:
        100 + adjustments.contrast,

      saturation:
        100 + adjustments.saturation,

      exposure:
        Math.pow(
          2,
          adjustments.exposure / 100
        ) * 100,

      blur:
        Math.max(
          0,
          adjustments.blur
        )
    };
  }

  function getCSSFilter() {
    const values =
      getFilterValues();

    let filter =
      `brightness(${values.brightness}%) ` +
      `contrast(${values.contrast}%) ` +
      `saturate(${values.saturation}%) ` +
      `brightness(${values.exposure}%) ` +
      `blur(${values.blur}px)`;

    switch (activeFilter) {
      case "mono":
        filter += " grayscale(100%)";
        break;

      case "sepia":
        filter += " sepia(75%)";
        break;

      case "vivid":
        filter +=
          " saturate(145%) contrast(108%)";
        break;

      case "warm":
        filter +=
          " sepia(15%) saturate(115%)";
        break;

      case "cool":
        filter +=
          " hue-rotate(12deg) saturate(90%)";
        break;

      case "vintage":
        filter +=
          " sepia(35%) contrast(90%) saturate(80%)";
        break;

      case "cinematic":
        filter +=
          " contrast(112%) saturate(108%)";
        break;

      default:
        break;
    }

    return filter;
  }

  function renderImage() {
    if (!hasImage) {
      return;
    }

    if (showingOriginal) {
      if (originalCanvas) {
        canvas.width =
          originalCanvas.width;

        canvas.height =
          originalCanvas.height;

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.drawImage(
          originalCanvas,
          0,
          0
        );
      }

      return;
    }

    const transformed =
      getTransformedCanvas();

    if (!transformed) {
      return;
    }

    canvas.width =
      transformed.width;

    canvas.height =
      transformed.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.save();

    ctx.filter =
      getCSSFilter();

    ctx.drawImage(
      transformed,
      0,
      0
    );

    ctx.restore();

    applyTemperature();
    applyVignette();
    applySharpen();

    drawTextObjects();

    updateCropBox();
  }

  /* =========================================================
     ADJUSTMENTS
     ========================================================= */

  function applyTemperature() {
    const amount =
      Number(adjustments.temperature) || 0;

    if (!amount) {
      return;
    }

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const data =
      imageData.data;

    const red =
      amount * 0.55;

    const blue =
      amount * -0.55;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      data[i] =
        clamp(
          data[i] + red,
          0,
          255
        );

      data[i + 2] =
        clamp(
          data[i + 2] + blue,
          0,
          255
        );
    }

    ctx.putImageData(
      imageData,
      0,
      0
    );
  }

  function applyVignette() {
    const amount =
      Number(adjustments.vignette) || 0;

    if (!amount) {
      return;
    }

    const gradient =
      ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(
          canvas.width,
          canvas.height
        ) * 0.2,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(
          canvas.width,
          canvas.height
        ) * 0.75
      );

    const alpha =
      clamp(amount / 100, 0, 0.8);

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      `rgba(0,0,0,${alpha})`
    );

    ctx.save();

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();
  }

  function applySharpen() {
    const amount =
      Number(adjustments.sharpen) || 0;

    if (amount <= 0) {
      return;
    }

    const strength =
      clamp(amount / 100, 0, 1);

    const source =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const src =
      source.data;

    const copy =
      new Uint8ClampedArray(src);

    const width =
      canvas.width;

    const height =
      canvas.height;

    for (
      let y = 1;
      y < height - 1;
      y++
    ) {
      for (
        let x = 1;
        x < width - 1;
        x++
      ) {
        const index =
          (y * width + x) * 4;

        for (
          let channel = 0;
          channel < 3;
          channel++
        ) {
          const top =
            copy[
              ((y - 1) * width + x) * 4 +
              channel
            ];

          const bottom =
            copy[
              ((y + 1) * width + x) * 4 +
              channel
            ];

          const left =
            copy[
              (y * width + x - 1) * 4 +
              channel
            ];

          const right =
            copy[
              (y * width + x + 1) * 4 +
              channel
            ];

          const center =
            copy[index + channel];

          const sharpened =
            clamp(
              center * 5 -
              top -
              bottom -
              left -
              right,
              0,
              255
            );

          src[index + channel] =
            center +
            (sharpened - center) *
            strength;
        }
      }
    }

    ctx.putImageData(
      source,
      0,
      0
    );
  }

  function updateAdjustment(
    name,
    value,
    commit = true
  ) {
    if (!(name in adjustments)) {
      return;
    }

    adjustments[name] =
      Number(value) || 0;

    renderImage();

    if (commit) {
      saveHistory();
    }
  }

  /* =========================================================
     FILTERS
     ========================================================= */

  function applyFilter(name) {
    activeFilter =
      name || "none";

    renderImage();
    saveHistory();

    filterButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.filter ===
          activeFilter
      );
    });
  }

  /* =========================================================
     CROP
     ========================================================= */

  function getCanvasDisplayRect() {
    return canvas.getBoundingClientRect();
  }

  function canvasPointFromEvent(event) {
    const rect =
      getCanvasDisplayRect();

    if (!rect.width || !rect.height) {
      return {
        x: 0,
        y: 0
      };
    }

    return {
      x:
        clamp(
          (event.clientX - rect.left) *
            (canvas.width / rect.width),
          0,
          canvas.width
        ),

      y:
        clamp(
          (event.clientY - rect.top) *
            (canvas.height / rect.height),
          0,
          canvas.height
        )
    };
  }

  function getAspectRatio() {
    if (!crop.aspect || crop.aspect === "free") {
      return null;
    }

    const parts =
      crop.aspect.split(":");

    if (parts.length !== 2) {
      return null;
    }

    const a =
      Number(parts[0]);

    const b =
      Number(parts[1]);

    if (!a || !b) {
      return null;
    }

    return a / b;
  }

  function clampCropBox() {
    const minSize = 20;

    crop.width =
      clamp(
        crop.width,
        minSize,
        canvas.width
      );

    crop.height =
      clamp(
        crop.height,
        minSize,
        canvas.height
      );

    crop.x =
      clamp(
        crop.x,
        0,
        canvas.width - crop.width
      );

    crop.y =
      clamp(
        crop.y,
        0,
        canvas.height - crop.height
      );
  }

  function centerCrop(width, height) {
    crop.width =
      clamp(
        width,
        20,
        canvas.width
      );

    crop.height =
      clamp(
        height,
        20,
        canvas.height
      );

    crop.x =
      (canvas.width - crop.width) / 2;

    crop.y =
      (canvas.height - crop.height) / 2;
  }

  function activateCrop(aspect = crop.aspect) {
    crop.aspect =
      aspect || "free";

    crop.active = true;

    if (
      !crop.width ||
      !crop.height
    ) {
      crop.width =
        canvas.width;

      crop.height =
        canvas.height;

      crop.x = 0;
      crop.y = 0;
    }

    const ratio =
      getAspectRatio();

    if (ratio) {
      let width =
        canvas.width * 0.8;

      let height =
        width / ratio;

      if (height > canvas.height * 0.8) {
        height =
          canvas.height * 0.8;

        width =
          height * ratio;
      }

      centerCrop(
        width,
        height
      );
    } else {
      clampCropBox();
    }

    updateCropBox();
  }

  function updateCropBox() {
    if (!cropBox || !hasImage) {
      return;
    }

    if (!crop.active) {
      cropBox.hidden = true;
      return;
    }

    const rect =
      getCanvasDisplayRect();

    if (
      !rect.width ||
      !rect.height
    ) {
      cropBox.hidden = true;
      return;
    }

    cropBox.hidden = false;

    cropBox.style.left =
      `${(crop.x / canvas.width) * 100}%`;

    cropBox.style.top =
      `${(crop.y / canvas.height) * 100}%`;

    cropBox.style.width =
      `${(crop.width / canvas.width) * 100}%`;

    cropBox.style.height =
      `${(crop.height / canvas.height) * 100}%`;
  }

  function getCropHandle(event) {
    const target =
      event.target;

    if (
      target &&
      target.dataset &&
      target.dataset.cropHandle
    ) {
      return target.dataset.cropHandle;
    }

    return null;
  }

  function startCropInteraction(event) {
    if (
      !crop.active ||
      !hasImage
    ) {
      return;
    }

    const point =
      canvasPointFromEvent(event);

    const handle =
      getCropHandle(event);

    cropInteraction = {
      type:
        handle
          ? "resize"
          : "move",

      handle,

      startX: point.x,
      startY: point.y,

      originalX: crop.x,
      originalY: crop.y,

      originalWidth:
        crop.width,

      originalHeight:
        crop.height
    };

    event.preventDefault();
  }

  function updateCropInteraction(event) {
    if (!cropInteraction) {
      return;
    }

    const point =
      canvasPointFromEvent(event);

    const dx =
      point.x -
      cropInteraction.startX;

    const dy =
      point.y -
      cropInteraction.startY;

    if (
      cropInteraction.type === "move"
    ) {
      crop.x =
        cropInteraction.originalX +
        dx;

      crop.y =
        cropInteraction.originalY +
        dy;

      clampCropBox();

      updateCropBox();

      return;
    }

    resizeCrop(
      cropInteraction,
      dx,
      dy
    );

    updateCropBox();
  }

  function resizeCrop(interaction, dx, dy) {
    const minSize = 20;

    let left =
      interaction.originalX;

    let top =
      interaction.originalY;

    let right =
      interaction.originalX +
      interaction.originalWidth;

    let bottom =
      interaction.originalY +
      interaction.originalHeight;

    const handle =
      interaction.handle;

    if (handle.includes("w")) {
      left += dx;
    }

    if (handle.includes("e")) {
      right += dx;
    }

    if (handle.includes("n")) {
      top += dy;
    }

    if (handle.includes("s")) {
      bottom += dy;
    }

    left =
      clamp(
        left,
        0,
        right - minSize
      );

    right =
      clamp(
        right,
        left + minSize,
        canvas.width
      );

    top =
      clamp(
        top,
        0,
        bottom - minSize
      );

    bottom =
      clamp(
        bottom,
        top + minSize,
        canvas.height
      );

    const ratio =
      getAspectRatio();

    if (!ratio) {
      crop.x = left;
      crop.y = top;

      crop.width =
        right - left;

      crop.height =
        bottom - top;

      return;
    }

    const movingHorizontal =
      handle.includes("e") ||
      handle.includes("w");

    const movingVertical =
      handle.includes("n") ||
      handle.includes("s");

    let width =
      right - left;

    let height =
      bottom - top;

    if (movingHorizontal && !movingVertical) {
      height =
        width / ratio;
    } else {
      width =
        height * ratio;
    }

    if (width > canvas.width) {
      width =
        canvas.width;

      height =
        width / ratio;
    }

    if (height > canvas.height) {
      height =
        canvas.height;

      width =
        height * ratio;
    }

    if (handle.includes("w")) {
      left =
        right - width;
    } else {
      right =
        left + width;
    }

    if (handle.includes("n")) {
      top =
        bottom - height;
    } else {
      bottom =
        top + height;
    }

    if (left < 0) {
      left = 0;
      right =
        left + width;
    }

    if (top < 0) {
      top = 0;
      bottom =
        top + height;
    }

    if (right > canvas.width) {
      right =
        canvas.width;
      left =
        right - width;
    }

    if (bottom > canvas.height) {
      bottom =
        canvas.height;
      top =
        bottom - height;
    }

    crop.x = left;
    crop.y = top;

    crop.width =
      right - left;

    crop.height =
      bottom - top;
  }

  function stopCropInteraction() {
    if (!cropInteraction) {
      return;
    }

    cropInteraction = null;
  }

  function applyCrop() {
    if (
      !hasImage ||
      !crop.active
    ) {
      return;
    }

    clampCropBox();

    const x =
      Math.round(crop.x);

    const y =
      Math.round(crop.y);

    const width =
      Math.max(
        1,
        Math.round(crop.width)
      );

    const height =
      Math.max(
        1,
        Math.round(crop.height)
      );

    const source =
      cloneCanvas(canvas);

    canvas.width =
      width;

    canvas.height =
      height;

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.drawImage(
      source,
      x,
      y,
      width,
      height,
      0,
      0,
      width,
      height
    );

    crop.active = false;

    crop.x = 0;
    crop.y = 0;
    crop.width = width;
    crop.height = height;

    textObjects =
      textObjects
        .map((item) => ({
          ...item,
          x:
            item.x - x,
          y:
            item.y - y
        }))
        .filter(
          (item) =>
            item.x >= 0 &&
            item.y >= 0 &&
            item.x <= width &&
            item.y <= height
        );

    updateCropBox();

    saveHistory();

    toast("Crop applied.");
  }

  /* =========================================================
     ROTATE / FLIP
     ========================================================= */

  function rotate(degrees) {
    if (!hasImage) return;

    rotation += degrees;

    rotation =
      ((rotation % 360) + 360) % 360;

    renderImage();
    saveHistory();
  }

  function flip(horizontal) {
    if (!hasImage) return;

    if (horizontal) {
      flipX *= -1;
    } else {
      flipY *= -1;
    }

    renderImage();
    saveHistory();
  }

  /* =========================================================
     DRAWING
     ========================================================= */

  function getDrawTool() {
    return (
      drawToolGroup?.querySelector(
        "[data-draw-tool].active"
      )?.dataset.drawTool ||
      draw.tool
    );
  }

  function drawPoint(x, y) {
    ctx.save();

    if (draw.tool === "eraser") {
      ctx.globalCompositeOperation =
        "destination-out";
    } else {
      ctx.globalCompositeOperation =
        "source-over";
    }

    ctx.strokeStyle =
      draw.color;

    ctx.fillStyle =
      draw.color;

    ctx.lineWidth =
      draw.size;

    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";

    ctx.beginPath();

    ctx.moveTo(
      draw.currentX,
      draw.currentY
    );

    ctx.lineTo(
      x,
      y
    );

    ctx.stroke();

    ctx.restore();

    draw.currentX = x;
    draw.currentY = y;
  }

  function drawShapePreview(
    tool,
    startX,
    startY,
    endX,
    endY
  ) {
    renderImage();

    ctx.save();

    ctx.strokeStyle =
      draw.color;

    ctx.fillStyle =
      draw.color;

    ctx.lineWidth =
      draw.size;

    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";

    const width =
      endX - startX;

    const height =
      endY - startY;

    if (tool === "line") {
      ctx.beginPath();

      ctx.moveTo(
        startX,
        startY
      );

      ctx.lineTo(
        endX,
        endY
      );

      ctx.stroke();
    }

    if (tool === "rect") {
      ctx.strokeRect(
        startX,
        startY,
        width,
        height
      );
    }

    if (tool === "circle") {
      const radius =
        Math.sqrt(
          width * width +
          height * height
        ) / 2;

      const centerX =
        startX + width / 2;

      const centerY =
        startY + height / 2;

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function startDrawing(event) {
    if (
      !hasImage ||
      crop.active
    ) {
      return;
    }

    const tool =
      getDrawTool();

    draw.tool = tool;

    const point =
      canvasPointFromEvent(event);

    draw.drawing = true;

    draw.startX =
      point.x;

    draw.startY =
      point.y;

    draw.currentX =
      point.x;

    draw.currentY =
      point.y;

    if (
      tool === "brush" ||
      tool === "eraser"
    ) {
      ctx.save();

      if (tool === "eraser") {
        ctx.globalCompositeOperation =
          "destination-out";
      }

      ctx.strokeStyle =
        draw.color;

      ctx.lineWidth =
        draw.size;

      ctx.lineCap =
        "round";

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        draw.size / 2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        draw.color;

      ctx.fill();

      ctx.restore();
    }

    event.preventDefault();
  }

  function moveDrawing(event) {
    if (!draw.drawing) {
      return;
    }

    const point =
      canvasPointFromEvent(event);

    if (
      draw.tool === "brush" ||
      draw.tool === "eraser"
    ) {
      drawPoint(
        point.x,
        point.y
      );
    } else {
      drawShapePreview(
        draw.tool,
        draw.startX,
        draw.startY,
        point.x,
        point.y
      );
    }

    event.preventDefault();
  }

  function stopDrawing(event) {
    if (!draw.drawing) {
      return;
    }

    const point =
      event
        ? canvasPointFromEvent(event)
        : {
            x: draw.currentX,
            y: draw.currentY
          };

    if (
      draw.tool === "line" ||
      draw.tool === "rect" ||
      draw.tool === "circle"
    ) {
      drawShapePreview(
        draw.tool,
        draw.startX,
        draw.startY,
        point.x,
        point.y
      );
    }

    draw.drawing = false;

    saveHistory();
  }

  /* =========================================================
     TEXT
     ========================================================= */

  function drawTextObjects() {
    if (!textObjects.length) {
      return;
    }

    ctx.save();

    ctx.textBaseline =
      "top";

    textObjects.forEach((item) => {
      ctx.fillStyle =
        item.color || "#ffffff";

      ctx.font =
        `${item.size || 48}px sans-serif`;

      ctx.shadowColor =
        "rgba(0,0,0,.35)";

      ctx.shadowBlur = 3;

      ctx.fillText(
        item.text,
        item.x,
        item.y
      );
    });

    ctx.restore();
  }

  function addText() {
    if (
      !hasImage ||
      !textInput
    ) {
      return;
    }

    const text =
      textInput.value.trim();

    if (!text) {
      toast(
        "Enter some text first.",
        "error"
      );

      return;
    }

    const size =
      Number(textSize?.value) || 48;

    const color =
      textColor?.value || "#ffffff";

    textObjects.push({
      text,
      x:
        canvas.width / 2,
      y:
        canvas.height / 2,
      size,
      color
    });

    renderImage();
    saveHistory();

    textInput.value = "";

    toast("Text added.");
  }

  /* =========================================================
     BEFORE / AFTER
     ========================================================= */

  function toggleBeforeAfter() {
    if (!hasImage) {
      return;
    }

    showingOriginal =
      !showingOriginal;

    renderImage();

    if (beforeAfterButton) {
      beforeAfterButton.classList.toggle(
        "active",
        showingOriginal
      );
    }
  }

  /* =========================================================
     RESET
     ========================================================= */

  function resetEditor() {
    if (!hasImage || !originalCanvas) {
      return;
    }

    canvas.width =
      originalCanvas.width;

    canvas.height =
      originalCanvas.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      originalCanvas,
      0,
      0
    );

    rotation = 0;
    flipX = 1;
    flipY = 1;

    adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      temperature: 0,
      vignette: 0,
      blur: 0,
      sharpen: 0
    };

    activeFilter = "none";

    textObjects = [];

    crop = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    };

    showingOriginal = false;

    setZoom(1);

    syncControls();
    updateCropBox();

    saveHistory();

    toast("Editor reset.");
  }

  /* =========================================================
     DOWNLOAD
     ========================================================= */

  function downloadImage() {
    if (!hasImage) {
      toast(
        "Load an image first.",
        "error"
      );

      return;
    }

    if (crop.active) {
      toast(
        "Apply the crop before downloading.",
        "error"
      );

      return;
    }

    const output =
      createCanvas(
        canvas.width,
        canvas.height
      );

    const outputCtx =
      output.getContext("2d");

    outputCtx.drawImage(
      canvas,
      0,
      0
    );

    output.toBlob(
      (blob) => {
        if (!blob) {
          toast(
            "Could not create image.",
            "error"
          );

          return;
        }

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download =
          `ozlind-edited-${Date.now()}.png`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      },
      "image/png"
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen() {
    if (!canvasWrap) {
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await canvasWrap.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      toast(
        "Fullscreen is not available.",
        "error"
      );
    }
  }

  /* =========================================================
     CONTROL SYNC
     ========================================================= */

  function syncControls() {
    adjustControls.forEach((control) => {
      const name =
        control.dataset.adjust;

      if (
        name &&
        name in adjustments
      ) {
        control.value =
          adjustments[name];
      }
    });

    filterButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.filter ===
          activeFilter
      );
    });

    if (straightenSlider) {
      straightenSlider.value = 0;
    }

    if (brushColor) {
      brushColor.value =
        draw.color;
    }

    if (brushSize) {
      brushSize.value =
        draw.size;
    }

    if (brushSizeValue) {
      brushSizeValue.textContent =
        String(draw.size);
    }

    if (textColor) {
      textColor.value =
        textObjects.length
          ? textObjects[
              textObjects.length - 1
            ].color || "#ffffff"
          : textColor.value;
    }

    if (textSizeValue && textSize) {
      textSizeValue.textContent =
        textSize.value;
    }

    updateHistoryButtons();
  }

  /* =========================================================
     TABS
     ========================================================= */

  function activateTab(name) {
    tabs.forEach((tab) => {
      tab.classList.toggle(
        "active",
        tab.dataset.tab === name
      );
    });

    panels.forEach((panel) => {
      panel.hidden =
        panel.dataset.panel !== name;
    });

    if (name === "crop") {
      if (hasImage) {
        activateCrop(crop.aspect);
      }
    } else {
      crop.active = false;
      updateCropBox();
    }
  }

  /* =========================================================
     CROP BOX EVENTS
     ========================================================= */

  function setupCropBox() {
    if (!cropBox) {
      return;
    }

    const handles =
      cropBox.querySelectorAll(
        "[data-crop-handle]"
      );

    handles.forEach((handle) => {
      handle.addEventListener(
        "pointerdown",
        startCropInteraction
      );
    });

    cropBox.addEventListener(
      "pointerdown",
      (event) => {
        if (
          getCropHandle(event)
        ) {
          return;
        }

        startCropInteraction(event);
      }
    );
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  uploadButton?.addEventListener(
    "click",
    () => fileInput?.click()
  );

  fileInput?.addEventListener(
    "change",
    () => {
      const file =
        fileInput.files?.[0];

      if (file) {
        loadFile(file);
      }

      fileInput.value = "";
    }
  );

  dropzone?.addEventListener(
    "dragover",
    (event) => {
      event.preventDefault();

      dropzone.classList.add(
        "dragover"
      );
    }
  );

  dropzone?.addEventListener(
    "dragleave",
    () => {
      dropzone.classList.remove(
        "dragover"
      );
    }
  );

  dropzone?.addEventListener(
    "drop",
    (event) => {
      event.preventDefault();

      dropzone.classList.remove(
        "dragover"
      );

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        loadFile(file);
      }
    }
  );

  undoButton?.addEventListener(
    "click",
    undo
  );

  redoButton?.addEventListener(
    "click",
    redo
  );

  beforeAfterButton?.addEventListener(
    "click",
    toggleBeforeAfter
  );

  resetButton?.addEventListener(
    "click",
    resetEditor
  );

  zoomOutButton?.addEventListener(
    "click",
    () =>
      setZoom(
        zoom - 0.1
      )
  );

  zoomInButton?.addEventListener(
    "click",
    () =>
      setZoom(
        zoom + 0.1
      )
  );

  fullscreenButton?.addEventListener(
    "click",
    toggleFullscreen
  );

  tabs.forEach((tab) => {
    tab.addEventListener(
      "click",
      () =>
        activateTab(
          tab.dataset.tab
        )
    );
  });

  aspectGroup?.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-aspect]"
        );

      if (!button) {
        return;
      }

      const aspect =
        button.dataset.aspect ||
        "free";

      aspectGroup
        .querySelectorAll(
          "[data-aspect]"
        )
        .forEach((item) => {
          item.classList.toggle(
            "active",
            item === button
          );
        });

      activateCrop(aspect);
    }
  );

  applyCropButton?.addEventListener(
    "click",
    applyCrop
  );

  rotateLeftButton?.addEventListener(
    "click",
    () => rotate(-90)
  );

  rotateRightButton?.addEventListener(
    "click",
    () => rotate(90)
  );

  flipHButton?.addEventListener(
    "click",
    () => flip(true)
  );

  flipVButton?.addEventListener(
    "click",
    () => flip(false)
  );

  straightenSlider?.addEventListener(
    "input",
    () => {
      if (!hasImage) return;

      const value =
        Number(
          straightenSlider.value
        ) || 0;

      rotation =
        value;

      renderImage();
    }
  );

  straightenSlider?.addEventListener(
    "change",
    saveHistory
  );

  adjustControls.forEach(
    (control) => {
      control.addEventListener(
        "input",
        () => {
          updateAdjustment(
            control.dataset.adjust,
            control.value,
            false
          );
        }
      );

      control.addEventListener(
        "change",
        () => {
          updateAdjustment(
            control.dataset.adjust,
            control.value,
            true
          );
        }
      );
    }
  );

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        () =>
          applyFilter(
            button.dataset.filter
          )
      );
    }
  );

  drawToolGroup?.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-draw-tool]"
        );

      if (!button) {
        return;
      }

      draw.tool =
        button.dataset.drawTool;

      drawToolGroup
        .querySelectorAll(
          "[data-draw-tool]"
        )
        .forEach((item) => {
          item.classList.toggle(
            "active",
            item === button
          );
        });
    }
  );

  brushColor?.addEventListener(
    "input",
    () => {
      draw.color =
        brushColor.value;
    }
  );

  brushSize?.addEventListener(
    "input",
    () => {
      draw.size =
        clamp(
          Number(brushSize.value) || 8,
          1,
          200
        );

      if (brushSizeValue) {
        brushSizeValue.textContent =
          String(draw.size);
      }
    }
  );

  textSize?.addEventListener(
    "input",
    () => {
      if (textSizeValue) {
        textSizeValue.textContent =
          textSize.value;
      }
    }
  );

  addTextButton?.addEventListener(
    "click",
    addText
  );

  textInput?.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        addText();
      }
    }
  );

  downloadButton?.addEventListener(
    "click",
    downloadImage
  );

  /* =========================================================
     POINTER EVENTS
     ========================================================= */

  canvas?.addEventListener(
    "pointerdown",
    startDrawing
  );

  canvas?.addEventListener(
    "pointermove",
    moveDrawing
  );

  window.addEventListener(
    "pointerup",
    stopDrawing
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (cropInteraction) {
        updateCropInteraction(event);
      }
    }
  );

  window.addEventListener(
    "pointerup",
    stopCropInteraction
  );

  window.addEventListener(
    "resize",
    updateCropBox
  );

  /* =========================================================
     KEYBOARD
     ========================================================= */

  document.addEventListener(
    "keydown",
    (event) => {
      const target =
        event.target;

      const typing =
        target &&
        (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        );

      if (
        !typing &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if (
        !typing &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      }

      if (
        event.key === "Escape" &&
        crop.active
      ) {
        crop.active = false;
        updateCropBox();
      }
    }
  );

  /* =========================================================
     INITIAL UI
     ========================================================= */

  panels.forEach((panel) => {
    panel.hidden = true;
  });

  const firstTab =
    tabs[0];

  if (firstTab) {
    activateTab(
      firstTab.dataset.tab
    );
  }

  showWorkspace(false);
  updateZoom();
  updateHistoryButtons();

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.OZLIND_EDITOR = {
    loadFile,
    undo,
    redo,
    reset: resetEditor,
    download: downloadImage,
    zoomIn: () =>
      setZoom(zoom + 0.1),
    zoomOut: () =>
      setZoom(zoom - 0.1),
    getCanvas: () => canvas
  };

})();
