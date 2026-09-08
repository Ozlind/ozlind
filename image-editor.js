(() => {
  "use strict";

  /* =========================================================
     OZLIND IMAGE EDITOR
     Premium client-side image editor
     No external libraries
     ========================================================= */

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_DIMENSION = 2400;
  const MAX_HISTORY = 30;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

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
    console.warn("OZLIND: #editorCanvas not found.");
    return;
  }

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!ctx) {
    console.error("OZLIND: Canvas unavailable.");
    return;
  }

  /* =========================================================
     STATE
     ========================================================= */

  let hasImage = false;

  let originalCanvas = null;
  let beforeCanvas = null;

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
    drawing: false
  };

  let textObjects = [];

  /* =========================================================
     HELPERS
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
    el.className = type === "error"
      ? "toast toast--error"
      : "toast";

    el.textContent = message;
    stack.appendChild(el);

    setTimeout(() => el.remove(), 3000);
  }

  function createCanvas(width, height) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));
    return c;
  }

  function cloneCanvas(source) {
    const c = createCanvas(
      source.width,
      source.height
    );

    c.getContext("2d").drawImage(source, 0, 0);
    return c;
  }

  function fitImageSize(width, height) {
    if (
      width <= MAX_DIMENSION &&
      height <= MAX_DIMENSION
    ) {
      return { width, height };
    }

    const scale = Math.min(
      MAX_DIMENSION / width,
      MAX_DIMENSION / height
    );

    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
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
      canvasWrap.style.transform =
        `scale(${zoom})`;
      canvasWrap.style.transformOrigin =
        "center center";
    }
  }

  function setZoom(value) {
    zoom = clamp(value, 0.25, 4);
    updateZoom();
  }

  /* =========================================================
     HISTORY
     ========================================================= */

  function makeSnapshot() {
    if (!hasImage) return null;

    return {
      canvas: cloneCanvas(canvas),
      originalCanvas: originalCanvas
        ? cloneCanvas(originalCanvas)
        : null,

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

      textObjects: textObjects.map((x) => ({
        ...x
      }))
    };
  }

  function saveHistory() {
    const state = makeSnapshot();

    if (!state) return;

    history =
      history.slice(0, historyIndex + 1);

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
        !hasImage || historyIndex <= 0;
    }

    if (redoButton) {
      redoButton.disabled =
        !hasImage ||
        historyIndex >= history.length - 1;
    }
  }

  function restoreState(state) {
    if (!state?.canvas) return;

    canvas.width = state.canvas.width;
    canvas.height = state.canvas.height;

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

    originalCanvas =
      state.originalCanvas
        ? cloneCanvas(state.originalCanvas)
        : cloneCanvas(state.canvas);

    rotation = state.rotation || 0;
    flipX = state.flipX || 1;
    flipY = state.flipY || 1;

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
        ? state.textObjects.map((x) => ({ ...x }))
        : [];

    syncControls();
    updateCropBox();
    updateHistoryButtons();
  }

  function undo() {
    if (
      !hasImage ||
      historyIndex <= 0
    ) return;

    historyIndex--;

    restoreState(
      history[historyIndex]
    );
  }

  function redo() {
    if (
      !hasImage ||
      historyIndex >= history.length - 1
    ) return;

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
      return "Please select an image file.";
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

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        initializeImage(image);
      };

      image.onerror = () => {
        toast(
          "Unable to load image.",
          "error"
        );
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      toast(
        "Unable to read image.",
        "error"
      );
    };

    reader.readAsDataURL(file);
  }

  function initializeImage(image) {
    const size = fitImageSize(
      image.naturalWidth,
      image.naturalHeight
    );

    originalCanvas =
      createCanvas(
        size.width,
        size.height
      );

    originalCanvas
      .getContext("2d")
      .drawImage(
        image,
        0,
        0,
        size.width,
        size.height
      );

    beforeCanvas =
      cloneCanvas(originalCanvas);

    canvas.width = size.width;
    canvas.height = size.height;

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

    toast("Image ready.");
  }

  /* =========================================================
     TRANSFORM
     ========================================================= */

  function transformedBase() {
    if (!originalCanvas) return null;

    const angle =
      ((rotation % 360) + 360) % 360;

    const swap =
      angle === 90 ||
      angle === 270;

    const width =
      swap
        ? originalCanvas.height
        : originalCanvas.width;

    const height =
      swap
        ? originalCanvas.width
        : originalCanvas.height;

    const c = createCanvas(
      width,
      height
    );

    const cctx =
      c.getContext("2d");

    cctx.save();

    cctx.translate(
      width / 2,
      height / 2
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

  /* =========================================================
     FILTERS + ADJUSTMENTS
     ========================================================= */

  function filterString() {
    let value =
      `brightness(${100 + adjustments.brightness}%) ` +
      `contrast(${100 + adjustments.contrast}%) ` +
      `saturate(${100 + adjustments.saturation}%) ` +
      `brightness(${Math.pow(2, adjustments.exposure / 100) * 100}%) ` +
      `blur(${Math.max(0, adjustments.blur)}px)`;

    switch (activeFilter) {
      case "mono":
        value += " grayscale(100%)";
        break;

      case "sepia":
        value += " sepia(75%)";
        break;

      case "vivid":
        value +=
          " saturate(145%) contrast(110%)";
        break;

      case "warm":
        value +=
          " sepia(12%) saturate(115%)";
        break;

      case "cool":
        value +=
          " hue-rotate(12deg) saturate(92%)";
        break;

      case "dramatic":
        value +=
          " contrast(125%) saturate(110%)";
        break;

      case "fade":
        value +=
          " contrast(88%) saturate(80%) brightness(108%)";
        break;
    }

    return value;
  }

  function applyPixelAdjustments(source) {
    const c =
      createCanvas(
        source.width,
        source.height
      );

    const cctx =
      c.getContext("2d");

    cctx.filter =
      filterString();

    cctx.drawImage(
      source,
      0,
      0
    );

    cctx.filter = "none";

    if (adjustments.temperature !== 0) {
      const strength =
        Math.abs(adjustments.temperature) / 100;

      cctx.save();

      cctx.globalCompositeOperation =
        "source-atop";

      cctx.globalAlpha =
        strength * 0.22;

      cctx.fillStyle =
        adjustments.temperature > 0
          ? "#ff8a4c"
          : "#4c9cff";

      cctx.fillRect(
        0,
        0,
        c.width,
        c.height
      );

      cctx.restore();
    }

    if (adjustments.vignette > 0) {
      const strength =
        adjustments.vignette / 100;

      const gradient =
        cctx.createRadialGradient(
          c.width / 2,
          c.height / 2,
          Math.min(c.width, c.height) * .18,
          c.width / 2,
          c.height / 2,
          Math.max(c.width, c.height) * .72
        );

      gradient.addColorStop(
        0,
        "rgba(0,0,0,0)"
      );

      gradient.addColorStop(
        1,
        `rgba(0,0,0,${0.75 * strength})`
      );

      cctx.fillStyle = gradient;

      cctx.fillRect(
        0,
        0,
        c.width,
        c.height
      );
    }

    if (adjustments.sharpen > 0) {
      sharpenCanvas(
        c,
        adjustments.sharpen
      );
    }

    return c;
  }

  function sharpenCanvas(source, amount) {
    if (amount <= 0) return;

    const sctx =
      source.getContext("2d");

    const image =
      sctx.getImageData(
        0,
        0,
        source.width,
        source.height
      );

    const src = image.data;
    const copy = new Uint8ClampedArray(src);

    const width = source.width;
    const height = source.height;

    const strength =
      Math.min(amount / 100, 1);

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
        const i =
          (y * width + x) * 4;

        for (let channel = 0; channel < 3; channel++) {
          const center =
            copy[i + channel];

          const top =
            copy[((y - 1) * width + x) * 4 + channel];

          const bottom =
            copy[((y + 1) * width + x) * 4 + channel];

          const left =
            copy[(y * width + x - 1) * 4 + channel];

          const right =
            copy[(y * width + x + 1) * 4 + channel];

          const result =
            center * (1 + strength * 1.2) -
            ((top + bottom + left + right) *
              (strength * .3));

          src[i + channel] =
            clamp(result, 0, 255);
        }
      }
    }

    sctx.putImageData(
      image,
      0,
      0
    );
  }

  function render() {
    if (
      !hasImage ||
      !originalCanvas ||
      showingOriginal
    ) return;

    const base =
      transformedBase();

    if (!base) return;

    const result =
      applyPixelAdjustments(base);

    canvas.width = result.width;
    canvas.height = result.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      result,
      0,
      0
    );

    updateCropBox();
  }

  /* =========================================================
     CONTROL SYNC
     ========================================================= */

  function syncControls() {
    adjustControls.forEach((control) => {
      const key =
        control.dataset.adjust;

      if (
        key &&
        Object.prototype.hasOwnProperty.call(
          adjustments,
          key
        )
      ) {
        control.value =
          adjustments[key];
      }
    });

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
        `${draw.size}px`;
    }

    if (textColor) {
      textColor.value =
        textObjects.length
          ? textObjects.at(-1).color || "#ffffff"
          : "#ffffff";
    }

    if (textSizeValue && textSize) {
      textSizeValue.textContent =
        `${textSize.value}px`;
    }

    filterButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.filter ===
          activeFilter
      );
    });

    updateHistoryButtons();
  }

  /* =========================================================
     TABS
     ========================================================= */

  function activateTab(tab) {
    if (!tab) return;

    const name =
      tab.dataset.tab ||
      tab.dataset.panelTarget ||
      tab.getAttribute("aria-controls");

    tabs.forEach((item) => {
      const active =
        item === tab ||
        item.dataset.tab === name;

      item.classList.toggle(
        "active",
        active
      );

      item.setAttribute(
        "aria-selected",
        active ? "true" : "false"
      );
    });

    panels.forEach((panel) => {
      const panelName =
        panel.dataset.panel;

      panel.hidden =
        panelName !== name;
    });
  }

  /* =========================================================
     CROP
     ========================================================= */

  function setupCropBox() {
    if (!cropBox) return;

    if (
      !cropBox.querySelector(
        "[data-crop-handle]"
      )
    ) {
      const handles = [
        "nw", "n", "ne",
        "e", "se", "s",
        "sw", "w"
      ];

      handles.forEach((position) => {
        const handle =
          document.createElement("span");

        handle.dataset.cropHandle =
          position;

        cropBox.appendChild(handle);
      });
    }

    cropBox.hidden = true;

    updateCropBox();
  }

  function startCrop() {
    if (!hasImage) {
      toast("Upload an image first.");
      return;
    }

    crop.active = true;

    if (
      !crop.width ||
      !crop.height
    ) {
      crop.x = 0;
      crop.y = 0;
      crop.width = canvas.width;
      crop.height = canvas.height;
    }

    updateCropBox();
  }

  function canvasDisplayRect() {
    if (!canvas) return null;

    return canvas.getBoundingClientRect();
  }

  function updateCropBox() {
    if (
      !cropBox ||
      !hasImage ||
      !crop.active
    ) {
      if (cropBox) {
        cropBox.hidden = true;
      }

      return;
    }

    const rect =
      canvasDisplayRect();

    if (!rect) return;

    const sx =
      rect.width / canvas.width;

    const sy =
      rect.height / canvas.height;

    cropBox.hidden = false;

    cropBox.style.left =
      `${crop.x * sx}px`;

    cropBox.style.top =
      `${crop.y * sy}px`;

    cropBox.style.width =
      `${crop.width * sx}px`;

    cropBox.style.height =
      `${crop.height * sy}px`;
  }

  function pointerToCanvas(event) {
    const rect =
      canvasDisplayRect();

    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp(
        (event.clientX - rect.left) *
          (canvas.width / rect.width),
        0,
        canvas.width
      ),

      y: clamp(
        (event.clientY - rect.top) *
          (canvas.height / rect.height),
        0,
        canvas.height
      )
    };
  }

  function aspectRatio(value) {
    if (!value || value === "free") {
      return null;
    }

    const map = {
      square: 1,
      "1:1": 1,
      "4:5": 4 / 5,
      "5:4": 5 / 4,
      "3:4": 3 / 4,
      "4:3": 4 / 3,
      "16:9": 16 / 9,
      "9:16": 9 / 16,
      "3:2": 3 / 2,
      "2:3": 2 / 3
    };

    return map[value] || null;
  }

  function applyAspect(width, height, ratio) {
    if (!ratio) {
      return {
        width,
        height
      };
    }

    if (
      width / height >
      ratio
    ) {
      width =
        height * ratio;
    } else {
      height =
        width / ratio;
    }

    return {
      width,
      height
    };
  }

  function beginCropInteraction(
    event,
    handle = "move"
  ) {
    if (!crop.active) {
      startCrop();
    }

    const point =
      pointerToCanvas(event);

    cropInteraction = {
      handle,
      startX: point.x,
      startY: point.y,

      cropX: crop.x,
      cropY: crop.y,

      cropWidth: crop.width,
      cropHeight: crop.height
    };

    event.preventDefault();
  }

  function moveCropInteraction(event) {
    if (!cropInteraction) return;

    const point =
      pointerToCanvas(event);

    const dx =
      point.x -
      cropInteraction.startX;

    const dy =
      point.y -
      cropInteraction.startY;

    let x =
      cropInteraction.cropX;

    let y =
      cropInteraction.cropY;

    let width =
      cropInteraction.cropWidth;

    let height =
      cropInteraction.cropHeight;

    const handle =
      cropInteraction.handle;

    const ratio =
      aspectRatio(crop.aspect);

    if (handle === "move") {
      x += dx;
      y += dy;

      x = clamp(
        x,
        0,
        canvas.width - width
      );

      y = clamp(
        y,
        0,
        canvas.height - height
      );
    } else {
      let left = x;
      let top = y;
      let right = x + width;
      let bottom = y + height;

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

      left = clamp(left, 0, canvas.width - 10);
      top = clamp(top, 0, canvas.height - 10);
      right = clamp(right, left + 10, canvas.width);
      bottom = clamp(bottom, top + 10, canvas.height);

      width = right - left;
      height = bottom - top;

      if (ratio) {
        const next =
          applyAspect(
            width,
            height,
            ratio
          );

        if (
          handle.includes("w") ||
          handle.includes("e")
        ) {
          height = next.height;

          if (handle.includes("n")) {
            top = bottom - height;
          } else {
            bottom = top + height;
          }
        } else {
          width = next.width;

          if (handle.includes("w")) {
            left = right - width;
          } else {
            right = left + width;
          }
        }

        if (left < 0) {
          left = 0;
          width = right;
          height = width / ratio;
          bottom = top + height;
        }

        if (top < 0) {
          top = 0;
          height = bottom;
          width = height * ratio;
          right = left + width;
        }

        if (right > canvas.width) {
          right = canvas.width;
          width = right - left;
          height = width / ratio;
          bottom = top + height;
        }

        if (bottom > canvas.height) {
          bottom = canvas.height;
          height = bottom - top;
          width = height * ratio;
          right = left + width;
        }
      }

      x = clamp(
        left,
        0,
        canvas.width - 10
      );

      y = clamp(
        top,
        0,
        canvas.height - 10
      );

      width =
        clamp(
          right - x,
          10,
          canvas.width - x
        );

      height =
        clamp(
          bottom - y,
          10,
          canvas.height - y
        );
    }

    crop.x = x;
    crop.y = y;
    crop.width = width;
    crop.height = height;

    updateCropBox();
  }

  function finishCropInteraction() {
    cropInteraction = null;
  }

  function applyCrop() {
    if (
      !hasImage ||
      !crop.active
    ) {
      toast("Select a crop area first.");
      return;
    }

    const x =
      Math.round(crop.x);

    const y =
      Math.round(crop.y);

    const width =
      Math.round(crop.width);

    const height =
      Math.round(crop.height);

    if (
      width < 10 ||
      height < 10
    ) {
      toast(
        "Crop area is too small.",
        "error"
      );
      return;
    }

    const result =
      createCanvas(
        width,
        height
      );

    result
      .getContext("2d")
      .drawImage(
        canvas,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height
      );

    originalCanvas =
      cloneCanvas(result);

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      result,
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

    crop = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width,
      height
    };

    updateCropBox();
    syncControls();
    saveHistory();

    toast("Crop applied.");
  }

  /* =========================================================
     DRAWING
     ========================================================= */

  function canvasPointFromEvent(event) {
    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height)
    };
  }

  function beginDrawing(event) {
    if (!hasImage) return;

    if (
      draw.tool !== "brush" &&
      draw.tool !== "eraser"
    ) {
      return;
    }

    const point =
      canvasPointFromEvent(event);

    draw.drawing = true;

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = draw.size;

    ctx.strokeStyle =
      draw.color;

    ctx.globalCompositeOperation =
      draw.tool === "eraser"
        ? "destination-out"
        : "source-over";

    ctx.beginPath();
    ctx.moveTo(
      point.x,
      point.y
    );

    event.preventDefault();
  }

  function drawMove(event) {
    if (!draw.drawing) return;

    const point =
      canvasPointFromEvent(event);

    ctx.lineTo(
      point.x,
      point.y
    );

    ctx.stroke();

    event.preventDefault();
  }

  function endDrawing() {
    if (!draw.drawing) return;

    draw.drawing = false;

    ctx.restore();

    originalCanvas =
      cloneCanvas(canvas);

    saveHistory();
  }

  /* =========================================================
     TEXT
     ========================================================= */

  function addText() {
    if (!hasImage) {
      toast("Upload an image first.");
      return;
    }

    const value =
      textInput?.value?.trim();

    if (!value) {
      toast("Enter some text first.");
      return;
    }

    const color =
      textColor?.value || "#ffffff";

    const size =
      Number(textSize?.value || 42);

    const x =
      canvas.width / 2;

    const y =
      canvas.height / 2;

    ctx.save();

    ctx.font =
      `700 ${size}px Inter, Arial, sans-serif`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor =
      "rgba(0,0,0,.35)";

    ctx.shadowBlur = 6;

    ctx.fillStyle = color;

    ctx.fillText(
      value,
      x,
      y
    );

    ctx.restore();

    textObjects.push({
      text: value,
      x,
      y,
      size,
      color
    });

    originalCanvas =
      cloneCanvas(canvas);

    textInput.value = "";

    saveHistory();

    toast("Text added.");
  }

  /* =========================================================
     ROTATE / FLIP
     ========================================================= */

  function rotate(degrees) {
    if (!hasImage) return;

    rotation += degrees;

    render();

    saveHistory();
  }

  function flip(horizontal) {
    if (!hasImage) return;

    if (horizontal) {
      flipX *= -1;
    } else {
      flipY *= -1;
    }

    render();
    saveHistory();
  }

  /* =========================================================
     RESET
     ========================================================= */

  function resetEditor() {
    if (!beforeCanvas) {
      toast("Nothing to reset.");
      return;
    }

    originalCanvas =
      cloneCanvas(beforeCanvas);

    canvas.width =
      beforeCanvas.width;

    canvas.height =
      beforeCanvas.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      beforeCanvas,
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

    syncControls();
    updateCropBox();

    history = [];
    historyIndex = -1;

    saveHistory();

    toast("Editor reset.");
  }

  /* =========================================================
     BEFORE / AFTER
     ========================================================= */

  function toggleBeforeAfter() {
    if (!hasImage || !beforeCanvas) return;

    showingOriginal =
      !showingOriginal;

    if (showingOriginal) {
      canvas.width =
        beforeCanvas.width;

      canvas.height =
        beforeCanvas.height;

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        beforeCanvas,
        0,
        0
      );

      if (beforeAfterButton) {
        beforeAfterButton.setAttribute(
          "aria-pressed",
          "true"
        );
      }
    } else {
      render();

      if (beforeAfterButton) {
        beforeAfterButton.setAttribute(
          "aria-pressed",
          "false"
        );
      }
    }

    updateCropBox();
  }

  /* =========================================================
     DOWNLOAD
     ========================================================= */

  function downloadImage() {
    if (!hasImage) {
      toast("Upload an image first.");
      return;
    }

    if (showingOriginal) {
      showingOriginal = false;
      render();
    }

    const link =
      document.createElement("a");

    link.download =
      `ozlind-edit-${Date.now()}.png`;

    link.href =
      canvas.toDataURL(
        "image/png",
        1
      );

    link.click();

    toast("Image exported.");
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen() {
    const target =
      $("#editorWorkspace") ||
      canvasWrap;

    if (!target) return;

    try {
      if (!document.fullscreenElement) {
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast(
        "Fullscreen is not available."
      );
    }
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  if (uploadButton && fileInput) {
    uploadButton.addEventListener(
      "click",
      () => fileInput.click()
    );
  }

  if (fileInput) {
    fileInput.addEventListener(
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
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach(
      (eventName) => {
        dropzone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
            dropzone.classList.add(
              "is-dragging"
            );
          }
        );
      }
    );

    ["dragleave", "drop"].forEach(
      (eventName) => {
        dropzone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
            dropzone.classList.remove(
              "is-dragging"
            );
          }
        );
      }
    );

    dropzone.addEventListener(
      "drop",
      (event) => {
        const file =
          event.dataTransfer?.files?.[0];

        if (file) {
          loadFile(file);
        }
      }
    );
  }

  if (undoButton) {
    undoButton.addEventListener(
      "click",
      undo
    );
  }

  if (redoButton) {
    redoButton.addEventListener(
      "click",
      redo
    );
  }

  if (resetButton) {
    resetButton.addEventListener(
      "click",
      resetEditor
    );
  }

  if (beforeAfterButton) {
    beforeAfterButton.addEventListener(
      "click",
      toggleBeforeAfter
    );
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener(
      "click",
      () => setZoom(zoom - .1)
    );
  }

  if (zoomInButton) {
    zoomInButton.addEventListener(
      "click",
      () => setZoom(zoom + .1)
    );
  }

  if (fullscreenButton) {
    fullscreenButton.addEventListener(
      "click",
      toggleFullscreen
    );
  }

  tabs.forEach((tab) => {
    tab.addEventListener(
      "click",
      () => activateTab(tab)
    );
  });

  /* ROTATE */

  if (rotateLeftButton) {
    rotateLeftButton.addEventListener(
      "click",
      () => rotate(-90)
    );
  }

  if (rotateRightButton) {
    rotateRightButton.addEventListener(
      "click",
      () => rotate(90)
    );
  }

  if (flipHButton) {
    flipHButton.addEventListener(
      "click",
      () => flip(true)
    );
  }

  if (flipVButton) {
    flipVButton.addEventListener(
      "click",
      () => flip(false)
    );
  }

  if (straightenSlider) {
    straightenSlider.addEventListener(
      "input",
      () => {
        rotation =
          Number(
            straightenSlider.value
          ) || 0;

        render();
      }
    );

    straightenSlider.addEventListener(
      "change",
      () => saveHistory()
    );
  }

  /* ADJUSTMENTS */

  adjustControls.forEach(
    (control) => {
      control.addEventListener(
        "input",
        () => {
          const key =
            control.dataset.adjust;

          if (!key) return;

          adjustments[key] =
            Number(control.value);

          render();
        }
      );

      control.addEventListener(
        "change",
        () => saveHistory()
      );
    }
  );

  /* FILTERS */

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          activeFilter =
            button.dataset.filter ||
            "none";

          filterButtons.forEach(
            (item) => {
              item.classList.toggle(
                "active",
                item === button
              );
            }
          );

          render();
          saveHistory();
        }
      );
    }
  );

  /* CROP */

  if (aspectGroup) {
    aspectGroup.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "button"
          );

        if (!button) return;

        crop.aspect =
          button.dataset.aspect ||
          button.value ||
          "free";

        $$("#aspectGroup button")
          .forEach((item) => {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        startCrop();
        updateCropBox();
      }
    );
  }

  if (applyCropButton) {
    applyCropButton.addEventListener(
      "click",
      applyCrop
    );
  }

  if (cropBox) {
    cropBox.addEventListener(
      "pointerdown",
      (event) => {
        const handle =
          event.target.closest(
            "[data-crop-handle]"
          );

        beginCropInteraction(
          event,
          handle
            ? handle.dataset.cropHandle
            : "move"
        );

        cropBox.setPointerCapture?.(
          event.pointerId
        );
      }
    );

    cropBox.addEventListener(
      "pointermove",
      (event) => {
        moveCropInteraction(event);
      }
    );

    cropBox.addEventListener(
      "pointerup",
      finishCropInteraction
    );

    cropBox.addEventListener(
      "pointercancel",
      finishCropInteraction
    );
  }

  /* DRAW */

  if (drawToolGroup) {
    drawToolGroup.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "button"
          );

        if (!button) return;

        draw.tool =
          button.dataset.tool ||
          button.value ||
          "brush";

        $$("#drawToolGroup button")
          .forEach((item) => {
            item.classList.toggle(
              "active",
              item === button
            );
          });
      }
    );
  }

  if (brushColor) {
    brushColor.addEventListener(
      "input",
      () => {
        draw.color =
          brushColor.value;
      }
    );
  }

  if (brushSize) {
    brushSize.addEventListener(
      "input",
      () => {
        draw.size =
          clamp(
            Number(brushSize.value) || 8,
            1,
            100
          );

        if (brushSizeValue) {
          brushSizeValue.textContent =
            `${draw.size}px`;
        }
      }
    );
  }

  canvas.addEventListener(
    "pointerdown",
    beginDrawing
  );

  canvas.addEventListener(
    "pointermove",
    drawMove
  );

  canvas.addEventListener(
    "pointerup",
    endDrawing
  );

  canvas.addEventListener(
    "pointercancel",
    endDrawing
  );

  /* TEXT */

  if (addTextButton) {
    addTextButton.addEventListener(
      "click",
      addText
    );
  }

  if (textSize) {
    textSize.addEventListener(
      "input",
      () => {
        if (textSizeValue) {
          textSizeValue.textContent =
            `${textSize.value}px`;
        }
      }
    );
  }

  if (downloadButton) {
    downloadButton.addEventListener(
      "click",
      downloadImage
    );
  }

  /* =========================================================
     KEYBOARD SHORTCUTS
     ========================================================= */

  document.addEventListener(
    "keydown",
    (event) => {
      const modifier =
        event.ctrlKey ||
        event.metaKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }

        return;
      }

      if (
        modifier &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
        return;
      }

      if (
        event.key === "+" ||
        event.key === "="
      ) {
        setZoom(zoom + .1);
      }

      if (event.key === "-") {
        setZoom(zoom - .1);
      }

      if (event.key === "0") {
        setZoom(1);
      }
    }
  );

  /* =========================================================
     RESIZE
     ========================================================= */

  window.addEventListener(
    "resize",
    () => {
      updateCropBox();
    }
  );

  /* =========================================================
     INITIAL
     ========================================================= */

  showWorkspace(false);
  updateZoom();
  updateHistoryButtons();

  if (tabs[0]) {
    activateTab(tabs[0]);
  }

  setupCropBox();

  console.log(
    "OZLIND Image Editor initialized."
  );
})();
