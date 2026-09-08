(() => {
  "use strict";

  /* =========================================================
     OZLIND IMAGE EDITOR
     Browser-side canvas editor
     ========================================================= */

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 2400;
  const MAX_HISTORY = 25;

  /* =========================================================
     DOM
     ========================================================= */

  const fileInput = document.querySelector("#editorFileInput");
  const uploadButton = document.querySelector("#editorUpload");
  const dropzone = document.querySelector("#dropzone");
  const workspace = document.querySelector("#editorWorkspace");

  const canvas = document.querySelector("#editorCanvas");
  const canvasWrap = document.querySelector("#canvasWrap");

  const cropBox = document.querySelector("#cropBox");

  const undoButton = document.querySelector("#undoBtn");
  const redoButton = document.querySelector("#redoBtn");
  const beforeAfterButton = document.querySelector("#beforeAfterBtn");
  const resetButton = document.querySelector("#resetBtn");

  const zoomOutButton = document.querySelector("#zoomOutBtn");
  const zoomInButton = document.querySelector("#zoomInBtn");
  const zoomLabel = document.querySelector("#zoomLabel");
  const fullscreenButton = document.querySelector("#fullscreenBtn");

  const tabs = document.querySelectorAll(".etab");
  const panels = document.querySelectorAll(".etab-panel");

  const aspectGroup = document.querySelector("#aspectGroup");
  const applyCropButton = document.querySelector("#applyCropBtn");

  const rotateLeftButton =
    document.querySelector("#rotateLeftBtn");

  const rotateRightButton =
    document.querySelector("#rotateRightBtn");

  const flipHButton =
    document.querySelector("#flipHBtn");

  const flipVButton =
    document.querySelector("#flipVBtn");

  const straightenSlider =
    document.querySelector("#straightenSlider");

  const adjustControls =
    document.querySelectorAll("[data-adjust]");

  const filterButtons =
    document.querySelectorAll(".filter-swatch");

  const drawToolGroup =
    document.querySelector("#drawToolGroup");

  const brushColor =
    document.querySelector("#brushColor");

  const brushSize =
    document.querySelector("#brushSize");

  const brushSizeValue =
    document.querySelector("#brushSizeVal");

  const textInput =
    document.querySelector("#textInput");

  const addTextButton =
    document.querySelector("#addTextBtn");

  const textColor =
    document.querySelector("#textColor");

  const textSize =
    document.querySelector("#textSize");

  const textSizeValue =
    document.querySelector("#textSizeVal");

  const downloadButton =
    document.querySelector("#downloadBtn");

  /* =========================================================
     CONTEXT
     ========================================================= */

  const ctx = canvas?.getContext("2d", {
    willReadFrequently: false
  });

  if (!canvas || !ctx) {
    console.warn("OZLIND Image Editor: canvas unavailable.");
    return;
  }

  /* =========================================================
     STATE
     ========================================================= */

  let hasImage = false;

  let originalCanvas = null;
  let baseCanvas = null;

  let history = [];
  let historyIndex = -1;

  let zoom = 1;

  let isBeforeAfter = false;

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

  let cropState = {
    active: false,
    aspect: "free",
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };

  let drawingState = {
    active: false,
    tool: "brush",
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    color: "#ffffff",
    size: 8
  };

  let textState = {
    active: false
  };

  let lastPointer = null;

  /* =========================================================
     HELPERS
     ========================================================= */

  function toast(message, type = "info") {
    const stack = document.querySelector("#toastStack");

    if (!stack) {
      console.info(message);
      return;
    }

    const item = document.createElement("div");

    item.className =
      type === "error"
        ? "toast toast--error"
        : "toast";

    item.textContent = message;

    stack.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add("toast--show");
    });

    setTimeout(() => {
      item.classList.remove("toast--show");

      setTimeout(() => {
        item.remove();
      }, 200);
    }, 3000);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createCanvas(width, height) {
    const newCanvas = document.createElement("canvas");

    newCanvas.width = Math.max(1, Math.round(width));
    newCanvas.height = Math.max(1, Math.round(height));

    return newCanvas;
  }

  function copyCanvas(source) {
    const result = createCanvas(
      source.width,
      source.height
    );

    const resultCtx = result.getContext("2d");

    resultCtx.drawImage(source, 0, 0);

    return result;
  }

  function clearMainCanvas() {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  function fitDimensions(width, height) {
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / width,
      MAX_IMAGE_DIMENSION / height
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

  function updateZoomLabel() {
    if (zoomLabel) {
      zoomLabel.textContent =
        `${Math.round(zoom * 100)}%`;
    }

    if (canvasWrap) {
      canvasWrap.style.setProperty(
        "--editor-zoom",
        zoom
      );
    }
  }

  function setZoom(value) {
    zoom = clamp(value, 0.25, 4);
    updateZoomLabel();
  }

  /* =========================================================
     CANVAS HISTORY
     ========================================================= */

  function createHistorySnapshot() {
    if (!hasImage) return null;

    return {
      canvas: copyCanvas(canvas),

      rotation,
      flipX,
      flipY,

      adjustments: {
        ...adjustments
      },

      activeFilter,

      cropState: {
        ...cropState
      }
    };
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot?.canvas) return;

    canvas.width = snapshot.canvas.width;
    canvas.height = snapshot.canvas.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      snapshot.canvas,
      0,
      0
    );

    rotation = snapshot.rotation || 0;
    flipX = snapshot.flipX || 1;
    flipY = snapshot.flipY || 1;

    adjustments = {
      ...snapshot.adjustments
    };

    activeFilter =
      snapshot.activeFilter || "none";

    cropState = {
      ...snapshot.cropState
    };

    syncControls();
    updateCanvasDisplay();
  }

  function pushHistory() {
    const snapshot =
      createHistorySnapshot();

    if (!snapshot) return;

    history =
      history.slice(
        0,
        historyIndex + 1
      );

    history.push(snapshot);

    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    historyIndex =
      history.length - 1;

    updateHistoryButtons();
  }

  function undo() {
    if (historyIndex <= 0) {
      return;
    }

    historyIndex--;

    restoreSnapshot(
      history[historyIndex]
    );
  }

  function redo() {
    if (
      historyIndex >=
      history.length - 1
    ) {
      return;
    }

    historyIndex++;

    restoreSnapshot(
      history[historyIndex]
    );
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
        historyIndex >=
          history.length - 1;
    }
  }

  /* =========================================================
     IMAGE LOADING
     ========================================================= */

  function validateFile(file) {
    if (!file) {
      return "No image selected.";
    }

    if (!file.type.startsWith("image/")) {
      return "Please select an image file.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Image must be smaller than 25 MB.";
    }

    return null;
  }

  function loadImageFile(file) {
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
          "The selected image could not be loaded.",
          "error"
        );
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      toast(
        "Could not read the image file.",
        "error"
      );
    };

    reader.readAsDataURL(file);
  }

  function initializeImage(image) {
    const dimensions = fitDimensions(
      image.naturalWidth,
      image.naturalHeight
    );

    originalCanvas =
      createCanvas(
        dimensions.width,
        dimensions.height
      );

    const originalCtx =
      originalCanvas.getContext("2d");

    originalCtx.drawImage(
      image,
      0,
      0,
      dimensions.width,
      dimensions.height
    );

    baseCanvas =
      copyCanvas(originalCanvas);

    canvas.width =
      dimensions.width;

    canvas.height =
      dimensions.height;

    clearMainCanvas();

    ctx.drawImage(
      originalCanvas,
      0,
      0
    );

    hasImage = true;

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

    zoom = 1;

    cropState = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height
    };

    history = [];
    historyIndex = -1;

    showWorkspace(true);

    updateCanvasDisplay();

    pushHistory();

    setupCropBox();

    toast("Image loaded.");
  }

  /* =========================================================
     CANVAS RENDERING
     ========================================================= */

  function buildFilterString() {
    const brightness =
      100 + adjustments.brightness;

    const contrast =
      100 + adjustments.contrast;

    const saturation =
      100 + adjustments.saturation;

    const exposure =
      Math.pow(
        2,
        adjustments.exposure / 100
      );

    const exposurePercent =
      exposure * 100;

    const blur =
      Math.max(
        0,
        adjustments.blur
      );

    return [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      `brightness(${exposurePercent}%)`,
      `blur(${blur}px)`
    ].join(" ");
  }

  function applyTemperature(imageData) {
    const value =
      adjustments.temperature / 100;

    if (Math.abs(value) < 0.001) {
      return;
    }

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const strength = 35 * value;

      data[i] =
        clamp(
          data[i] + strength,
          0,
          255
        );

      data[i + 2] =
        clamp(
          data[i + 2] - strength,
          0,
          255
        );
    }
  }

  function applyVignette(context) {
    const amount =
      adjustments.vignette / 100;

    if (amount <= 0) return;

    const width = canvas.width;
    const height = canvas.height;

    const centerX = width / 2;
    const centerY = height / 2;

    const radius =
      Math.sqrt(
        centerX * centerX +
          centerY * centerY
      );

    const gradient =
      context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.15,
        centerX,
        centerY,
        radius
      );

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      Math.max(0, 0.55 - amount * 0.2),
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      `rgba(0,0,0,${Math.min(
        0.85,
        amount * 0.85
      )})`
    );

    context.save();

    context.fillStyle = gradient;
    context.fillRect(
      0,
      0,
      width,
      height
    );

    context.restore();
  }

  function applySharpen() {
    const amount =
      adjustments.sharpen / 100;

    if (amount <= 0) {
      return;
    }

    /*
     * Use a small convolution only once per render.
     * This keeps interactive adjustments responsive.
     */

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const source =
      imageData.data;

    const output =
      new Uint8ClampedArray(
        source
      );

    const width = canvas.width;
    const height = canvas.height;

    const center =
      1 + amount * 1.8;

    const side =
      -amount * 0.45;

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

        for (let channel = 0; channel < 3; channel++) {
          const top =
            source[
              ((y - 1) * width + x) * 4 +
                channel
            ];

          const bottom =
            source[
              ((y + 1) * width + x) * 4 +
                channel
            ];

          const left =
            source[
              (y * width + x - 1) * 4 +
                channel
            ];

          const right =
            source[
              (y * width + x + 1) * 4 +
                channel
            ];

          const current =
            source[index + channel];

          output[index + channel] =
            clamp(
              current * center +
                (top +
                  bottom +
                  left +
                  right) *
                  side,
              0,
              255
            );
        }
      }
    }

    imageData.data.set(output);

    ctx.putImageData(
      imageData,
      0,
      0
    );
  }

  function applyFilterPreset(context) {
    switch (activeFilter) {
      case "vivid":
        context.filter =
          "contrast(112%) saturate(128%) brightness(103%)";
        break;

      case "warm":
        context.filter =
          "sepia(12%) saturate(115%) contrast(105%)";
        break;

      case "cool":
        context.filter =
          "saturate(108%) hue-rotate(8deg) contrast(105%)";
        break;

      case "mono":
        context.filter =
          "grayscale(100%) contrast(108%)";
        break;

      case "dramatic":
        context.filter =
          "contrast(125%) saturate(92%) brightness(96%)";
        break;

      case "fade":
        context.filter =
          "contrast(88%) saturate(82%) brightness(108%)";
        break;

      case "cinematic":
        context.filter =
          "contrast(118%) saturate(105%) brightness(98%) sepia(5%)";
        break;

      default:
        context.filter = "none";
    }
  }

  function updateCanvasDisplay() {
    if (!hasImage || !baseCanvas) {
      return;
    }

    const source =
      isBeforeAfter
        ? originalCanvas
        : baseCanvas;

    if (!source) return;

    const angle =
      ((rotation % 360) + 360) % 360;

    const radians =
      (angle * Math.PI) / 180;

    const absCos =
      Math.abs(Math.cos(radians));

    const absSin =
      Math.abs(Math.sin(radians));

    const newWidth =
      Math.ceil(
        source.width * absCos +
          source.height * absSin
      );

    const newHeight =
      Math.ceil(
        source.width * absSin +
          source.height * absCos
      );

    const rendered =
      createCanvas(
        newWidth,
        newHeight
      );

    const renderCtx =
      rendered.getContext("2d");

    renderCtx.save();

    renderCtx.translate(
      newWidth / 2,
      newHeight / 2
    );

    renderCtx.rotate(
      radians
    );

    renderCtx.scale(
      flipX,
      flipY
    );

    applyFilterPreset(renderCtx);

    renderCtx.filter =
      isBeforeAfter
        ? "none"
        : buildFilterString();

    renderCtx.drawImage(
      source,
      -source.width / 2,
      -source.height / 2
    );

    renderCtx.restore();

    canvas.width =
      rendered.width;

    canvas.height =
      rendered.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      rendered,
      0,
      0
    );

    if (!isBeforeAfter) {
      const imageData =
        ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

      applyTemperature(imageData);

      ctx.putImageData(
        imageData,
        0,
        0
      );

      applySharpen();

      applyVignette(ctx);
    }

    updateCropGeometry();
  }

  /* =========================================================
     ADJUSTMENTS
     ========================================================= */

  function updateAdjustment(
    name,
    value,
    commit = true
  ) {
    if (!(name in adjustments)) {
      return;
    }

    const numeric =
      Number(value);

    if (!Number.isFinite(numeric)) {
      return;
    }

    adjustments[name] = numeric;

    updateSliderValue(
      name,
      numeric
    );

    updateCanvasDisplay();

    if (commit) {
      pushHistory();
    }
  }

  function updateSliderValue(
    name,
    value
  ) {
    const output =
      document.querySelector(
        `[data-adjust="${name}"]`
      )?.parentElement?.querySelector(
        ".slider-val"
      );

    if (!output) return;

    output.textContent =
      `${Math.round(value)}`;
  }

  function resetAdjustments() {
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

    syncControls();
    updateCanvasDisplay();
  }

  /* =========================================================
     ROTATION / FLIP
     ========================================================= */

  function rotateBy(degrees) {
    if (!hasImage) return;

    rotation =
      (rotation + degrees) % 360;

    if (rotation < 0) {
      rotation += 360;
    }

    updateCanvasDisplay();
    pushHistory();
  }

  function flipHorizontal() {
    if (!hasImage) return;

    flipX *= -1;

    updateCanvasDisplay();
    pushHistory();
  }

  function flipVertical() {
    if (!hasImage) return;

    flipY *= -1;

    updateCanvasDisplay();
    pushHistory();
  }

  /* =========================================================
     CROP
     ========================================================= */

  function getCropAspect() {
    const selected =
      aspectGroup?.querySelector(
        ".is-active"
      );

    return selected?.dataset.aspect || "free";
  }

  function calculateAspectRect(
    aspect,
    width,
    height
  ) {
    if (aspect === "free") {
      return {
        width,
        height
      };
    }

    if (aspect === "original") {
      return {
        width,
        height
      };
    }

    const parts =
      aspect.split(":");

    if (parts.length !== 2) {
      return {
        width,
        height
      };
    }

    const ratio =
      Number(parts[0]) /
      Number(parts[1]);

    if (!Number.isFinite(ratio) || ratio <= 0) {
      return {
        width,
        height
      };
    }

    let cropWidth = width;
    let cropHeight =
      cropWidth / ratio;

    if (cropHeight > height) {
      cropHeight = height;
      cropWidth =
        cropHeight * ratio;
    }

    return {
      width: cropWidth,
      height: cropHeight
    };
  }

  function setupCropBox() {
    if (!cropBox || !hasImage) {
      return;
    }

    cropState.aspect =
      getCropAspect();

    const rect =
      calculateAspectRect(
        cropState.aspect,
        canvas.width,
        canvas.height
      );

    cropState.width =
      rect.width;

    cropState.height =
      rect.height;

    cropState.x =
      (canvas.width - rect.width) / 2;

    cropState.y =
      (canvas.height - rect.height) / 2;

    cropState.active = true;

    updateCropGeometry();
  }

  function updateCropGeometry() {
    if (
      !cropBox ||
      !hasImage ||
      !cropState.active
    ) {
      return;
    }

    const displayScale =
      getCanvasDisplayScale();

    cropBox.style.left =
      `${cropState.x * displayScale}px`;

    cropBox.style.top =
      `${cropState.y * displayScale}px`;

    cropBox.style.width =
      `${cropState.width * displayScale}px`;

    cropBox.style.height =
      `${cropState.height * displayScale}px`;
  }

  function getCanvasDisplayScale() {
    if (!canvasWrap) {
      return 1;
    }

    const rect =
      canvas.getBoundingClientRect();

    if (!canvas.width) {
      return 1;
    }

    return (
      rect.width /
      canvas.width
    );
  }

  function applyCrop() {
    if (!hasImage) return;

    const x =
      clamp(
        Math.round(cropState.x),
        0,
        canvas.width - 1
      );

    const y =
      clamp(
        Math.round(cropState.y),
        0,
        canvas.height - 1
      );

    const width =
      clamp(
        Math.round(cropState.width),
        1,
        canvas.width - x
      );

    const height =
      clamp(
        Math.round(cropState.height),
        1,
        canvas.height - y
      );

    const cropped =
      createCanvas(
        width,
        height
      );

    const croppedCtx =
      cropped.getContext("2d");

    croppedCtx.drawImage(
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

    baseCanvas =
      copyCanvas(cropped);

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      cropped,
      0,
      0
    );

    /*
     * Crop is a committed operation.
     * Keep current adjustments but reset geometry.
     */

    rotation = 0;
    flipX = 1;
    flipY = 1;

    cropState = {
      active: false,
      aspect: getCropAspect(),
      x: 0,
      y: 0,
      width,
      height
    };

    pushHistory();

    updateCanvasDisplay();

    toast("Crop applied.");
  }

  /* =========================================================
     CROP POINTER CONTROL
     ========================================================= */

  let cropDrag = null;

  function startCropDrag(event) {
    if (
      !cropBox ||
      !cropState.active
    ) {
      return;
    }

    const rect =
      canvas.getBoundingClientRect();

    const scale =
      canvas.width /
      rect.width;

    cropDrag = {
      startX:
        (event.clientX - rect.left) *
        scale,

      startY:
        (event.clientY - rect.top) *
        scale,

      cropX: cropState.x,
      cropY: cropState.y
    };
  }

  function moveCropDrag(event) {
    if (!cropDrag) return;

    const rect =
      canvas.getBoundingClientRect();

    const scale =
      canvas.width /
      rect.width;

    const currentX =
      (event.clientX - rect.left) *
      scale;

    const currentY =
      (event.clientY - rect.top) *
      scale;

    let x =
      cropDrag.cropX +
      (currentX - cropDrag.startX);

    let y =
      cropDrag.cropY +
      (currentY - cropDrag.startY);

    x = clamp(
      x,
      0,
      canvas.width -
        cropState.width
    );

    y = clamp(
      y,
      0,
      canvas.height -
        cropState.height
    );

    cropState.x = x;
    cropState.y = y;

    updateCropGeometry();
  }

  function endCropDrag() {
    if (!cropDrag) return;

    cropDrag = null;
  }

  /* =========================================================
     DRAWING
     ========================================================= */

  function getPointerPosition(event) {
    const rect =
      canvas.getBoundingClientRect();

    const scaleX =
      canvas.width /
      rect.width;

    const scaleY =
      canvas.height /
      rect.height;

    return {
      x:
        (event.clientX - rect.left) *
        scaleX,

      y:
        (event.clientY - rect.top) *
        scaleY
    };
  }

  function getDrawTool() {
    return (
      drawToolGroup?.querySelector(
        ".is-active"
      )?.dataset.tool ||
      "brush"
    );
  }

  function beginDrawing(event) {
    if (!hasImage) return;

    if (
      !document
        .querySelector(
          '.etab.is-active[data-tab="draw"]'
        )
    ) {
      return;
    }

    const point =
      getPointerPosition(event);

    drawingState = {
      active: true,
      tool: getDrawTool(),
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      color:
        brushColor?.value ||
        "#ffffff",
      size:
        Number(
          brushSize?.value
        ) || 8
    };

    lastPointer = point;

    canvas.setPointerCapture?.(
      event.pointerId
    );
  }

  function drawFreehandSegment(
    from,
    to
  ) {
    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.lineWidth =
      drawingState.size;

    if (
      drawingState.tool ===
      "eraser"
    ) {
      ctx.globalCompositeOperation =
        "destination-out";
    } else {
      ctx.globalCompositeOperation =
        "source-over";

      ctx.strokeStyle =
        drawingState.color;
    }

    ctx.beginPath();

    ctx.moveTo(
      from.x,
      from.y
    );

    ctx.lineTo(
      to.x,
      to.y
    );

    ctx.stroke();

    ctx.restore();
  }

  function drawShapePreview(
    point
  ) {
    /*
     * Preview uses a temporary canvas.
     * This avoids repeatedly restoring PNG data
     * on every pointer move.
     */

    if (!baseCanvas) return;

    renderDrawingPreview(
      drawingState,
      point
    );
  }

  function renderDrawingPreview(
    state,
    point
  ) {
    const snapshot =
      drawingState.previewCanvas;

    if (!snapshot) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      snapshot,
      0,
      0
    );

    const x =
      state.startX;

    const y =
      state.startY;

    const width =
      point.x - x;

    const height =
      point.y - y;

    ctx.save();

    ctx.strokeStyle =
      state.color;

    ctx.fillStyle =
      state.color;

    ctx.lineWidth =
      state.size;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (state.tool === "line") {
      ctx.beginPath();

      ctx.moveTo(
        x,
        y
      );

      ctx.lineTo(
        point.x,
        point.y
      );

      ctx.stroke();
    }

    if (state.tool === "rectangle") {
      ctx.strokeRect(
        x,
        y,
        width,
        height
      );
    }

    if (state.tool === "circle") {
      const centerX =
        x + width / 2;

      const centerY =
        y + height / 2;

      const radiusX =
        Math.abs(width / 2);

      const radiusY =
        Math.abs(height / 2);

      ctx.beginPath();

      ctx.ellipse(
        centerX,
        centerY,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function continueDrawing(event) {
    if (!drawingState.active) {
      return;
    }

    const point =
      getPointerPosition(event);

    drawingState.currentX =
      point.x;

    drawingState.currentY =
      point.y;

    if (
      drawingState.tool ===
        "brush" ||
      drawingState.tool ===
        "eraser"
    ) {
      drawFreehandSegment(
        lastPointer,
        point
      );

      lastPointer = point;
      return;
    }

    drawShapePreview(point);
  }

  function endDrawing(event) {
    if (!drawingState.active) {
      return;
    }

    const point =
      getPointerPosition(event);

    if (
      drawingState.tool ===
        "line" ||
      drawingState.tool ===
        "rectangle" ||
      drawingState.tool ===
        "circle"
    ) {
      drawingState.currentX =
        point.x;

      drawingState.currentY =
        point.y;

      renderDrawingPreview(
        drawingState,
        point
      );
    }

    drawingState.active = false;
    lastPointer = null;

    delete drawingState.previewCanvas;

    pushHistory();

    updateCanvasDisplay();
  }

  function cancelDrawing() {
    if (!drawingState.active) {
      return;
    }

    drawingState.active = false;
    lastPointer = null;

    delete drawingState.previewCanvas;

    updateCanvasDisplay();
  }

  function prepareDrawingPreview() {
    drawingState.previewCanvas =
      copyCanvas(canvas);
  }

  /* =========================================================
     TEXT
     ========================================================= */

  function addText() {
    if (!hasImage) {
      toast(
        "Load an image first.",
        "error"
      );
      return;
    }

    const text =
      textInput?.value.trim();

    if (!text) {
      toast(
        "Enter some text first.",
        "error"
      );
      return;
    }

    const size =
      Number(
        textSize?.value
      ) || 48;

    const color =
      textColor?.value ||
      "#ffffff";

    ctx.save();

    ctx.font =
      `600 ${size}px Arial, sans-serif`;

    ctx.fillStyle =
      color;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.shadowColor =
      "rgba(0,0,0,.45)";

    ctx.shadowBlur =
      Math.max(2, size * 0.12);

    ctx.fillText(
      text,
      canvas.width / 2,
      canvas.height / 2
    );

    ctx.restore();

    pushHistory();

    if (textInput) {
      textInput.value = "";
    }

    toast("Text added.");
  }

  /* =========================================================
     BEFORE / AFTER
     ========================================================= */

  function toggleBeforeAfter() {
    if (!hasImage) return;

    isBeforeAfter =
      !isBeforeAfter;

    if (beforeAfterButton) {
      beforeAfterButton.classList.toggle(
        "is-active",
        isBeforeAfter
      );
    }

    updateCanvasDisplay();
  }

  /* =========================================================
     RESET
     ========================================================= */

  function resetEditor() {
    if (!originalCanvas) return;

    const confirmed =
      window.confirm(
        "Reset all image edits?"
      );

    if (!confirmed) {
      return;
    }

    baseCanvas =
      copyCanvas(originalCanvas);

    canvas.width =
      originalCanvas.width;

    canvas.height =
      originalCanvas.height;

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

    isBeforeAfter = false;

    cropState = {
      active: false,
      aspect: "free",
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    };

    syncControls();

    history = [];
    historyIndex = -1;

    pushHistory();

    updateCanvasDisplay();

    toast("Editor reset.");
  }

  /* =========================================================
     FILTERS
     ========================================================= */

  function selectFilter(name) {
    activeFilter =
      name || "none";

    filterButtons.forEach(
      button => {
        button.classList.toggle(
          "is-active",
          button.dataset.filter ===
            activeFilter
        );
      }
    );

    updateCanvasDisplay();

    pushHistory();
  }

  /* =========================================================
     CONTROLS
     ========================================================= */

  function syncControls() {
    adjustControls.forEach(
      control => {
        const name =
          control.dataset.adjust;

        if (!(name in adjustments)) {
          return;
        }

        control.value =
          adjustments[name];

        updateSliderValue(
          name,
          adjustments[name]
        );
      }
    );

    if (brushSizeValue && brushSize) {
      brushSizeValue.textContent =
        brushSize.value;
    }

    if (textSizeValue && textSize) {
      textSizeValue.textContent =
        textSize.value;
    }

    filterButtons.forEach(
      button => {
        button.classList.toggle(
          "is-active",
          button.dataset.filter ===
            activeFilter
        );
      }
    );

    if (beforeAfterButton) {
      beforeAfterButton.classList.toggle(
        "is-active",
        isBeforeAfter
      );
    }

    updateHistoryButtons();
  }

  /* =========================================================
     TABS
     ========================================================= */

  function activateTab(tabName) {
    tabs.forEach(tab => {
      const active =
        tab.dataset.tab ===
        tabName;

      tab.classList.toggle(
        "is-active",
        active
      );

      tab.setAttribute(
        "aria-selected",
        String(active)
      );
    });

    panels.forEach(panel => {
      panel.hidden =
        panel.dataset.panel !==
        tabName;
    });

    if (tabName === "crop") {
      setupCropBox();
    } else if (cropBox) {
      cropBox.hidden = true;
    }

    if (tabName === "draw") {
      prepareDrawingPreview();
    }
  }

  /* =========================================================
     EXPORT
     ========================================================= */

  function getExportType() {
    /*
     * If the download button is accompanied by a format
     * selector, use it. Otherwise default to JPEG.
     */

    const selector =
      document.querySelector(
        "#exportFormat"
      );

    const value =
      selector?.value;

    if (
      value === "png" ||
      value === "webp" ||
      value === "jpeg"
    ) {
      return value;
    }

    return "jpeg";
  }

  function downloadImage() {
    if (!hasImage) {
      toast(
        "Load an image first.",
        "error"
      );
      return;
    }

    const type =
      getExportType();

    const mime =
      type === "png"
        ? "image/png"
        : type === "webp"
        ? "image/webp"
        : "image/jpeg";

    const quality =
      type === "png"
        ? undefined
        : 0.92;

    canvas.toBlob(
      blob => {
        if (!blob) {
          toast(
            "Could not export image.",
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
          `ozlind-edited-${Date.now()}.${type}`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);

        toast(
          `Image exported as ${type.toUpperCase()}.`
        );
      },
      mime,
      quality
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen() {
    if (!canvasWrap) return;

    try {
      if (!document.fullscreenElement) {
        await canvasWrap.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.error(
        "Fullscreen error:",
        error
      );
    }
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEvents() {
    uploadButton?.addEventListener(
      "click",
      () => {
        fileInput?.click();
      }
    );

    fileInput?.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        if (file) {
          loadImageFile(file);
        }

        event.target.value = "";
      }
    );

    dropzone?.addEventListener(
      "dragover",
      event => {
        event.preventDefault();

        dropzone.classList.add(
          "is-dragging"
        );
      }
    );

    dropzone?.addEventListener(
      "dragleave",
      () => {
        dropzone.classList.remove(
          "is-dragging"
        );
      }
    );

    dropzone?.addEventListener(
      "drop",
      event => {
        event.preventDefault();

        dropzone.classList.remove(
          "is-dragging"
        );

        const file =
          event.dataTransfer?.files?.[0];

        if (file) {
          loadImageFile(file);
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
      () => {
        setZoom(
          zoom - 0.1
        );
      }
    );

    zoomInButton?.addEventListener(
      "click",
      () => {
        setZoom(
          zoom + 0.1
        );
      }
    );

    fullscreenButton?.addEventListener(
      "click",
      toggleFullscreen
    );

    tabs.forEach(tab => {
      tab.addEventListener(
        "click",
        () => {
          activateTab(
            tab.dataset.tab
          );
        }
      );
    });

    aspectGroup?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-aspect]"
          );

        if (!button) return;

        $$setActive(
          aspectGroup,
          button
        );

        cropState.aspect =
          button.dataset.aspect;

        setupCropBox();
      }
    );

    applyCropButton?.addEventListener(
      "click",
      applyCrop
    );

    rotateLeftButton?.addEventListener(
      "click",
      () => {
        rotateBy(-90);
      }
    );

    rotateRightButton?.addEventListener(
      "click",
      () => {
        rotateBy(90);
      }
    );

    flipHButton?.addEventListener(
      "click",
      flipHorizontal
    );

    flipVButton?.addEventListener(
      "click",
      flipVertical
    );

    straightenSlider?.addEventListener(
      "input",
      event => {
        rotation =
          Number(event.target.value) || 0;

        updateCanvasDisplay();
      }
    );

    straightenSlider?.addEventListener(
      "change",
      () => {
        pushHistory();
      }
    );

    adjustControls.forEach(
      control => {
        control.addEventListener(
          "input",
          event => {
            updateAdjustment(
              event.target.dataset.adjust,
              event.target.value,
              false
            );
          }
        );

        control.addEventListener(
          "change",
          event => {
            updateAdjustment(
              event.target.dataset.adjust,
              event.target.value,
              true
            );
          }
        );
      }
    );

    filterButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            selectFilter(
              button.dataset.filter
            );
          }
        );
      }
    );

    drawToolGroup?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-tool]"
          );

        if (!button) return;

        $$setActive(
          drawToolGroup,
          button
        );
      }
    );

    brushSize?.addEventListener(
      "input",
      () => {
        if (brushSizeValue) {
          brushSizeValue.textContent =
            brushSize.value;
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

    downloadButton?.addEventListener(
      "click",
      downloadImage
    );

    /* Crop dragging */

    cropBox?.addEventListener(
      "pointerdown",
      event => {
        if (!cropState.active) return;

        event.preventDefault();

        startCropDrag(event);

        cropBox.setPointerCapture?.(
          event.pointerId
        );
      }
    );

    cropBox?.addEventListener(
      "pointermove",
      event => {
        if (!cropDrag) return;

        event.preventDefault();

        moveCropDrag(event);
      }
    );

    cropBox?.addEventListener(
      "pointerup",
      endCropDrag
    );

    cropBox?.addEventListener(
      "pointercancel",
      endCropDrag
    );

    /* Canvas drawing */

    canvas.addEventListener(
      "pointerdown",
      event => {
        if (
          getDrawTool() ===
          "brush"
        ) {
          beginDrawing(event);
        } else if (
          getDrawTool() ===
            "eraser" ||
          getDrawTool() ===
            "line" ||
          getDrawTool() ===
            "rectangle" ||
          getDrawTool() ===
            "circle"
        ) {
          beginDrawing(event);
        }
      }
    );

    canvas.addEventListener(
      "pointermove",
      event => {
        continueDrawing(event);
      }
    );

    canvas.addEventListener(
      "pointerup",
      event => {
        endDrawing(event);
      }
    );

    canvas.addEventListener(
      "pointercancel",
      cancelDrawing
    );

    canvas.addEventListener(
      "pointerleave",
      event => {
        if (
          drawingState.active &&
          (
            drawingState.tool ===
              "brush" ||
            drawingState.tool ===
              "eraser"
          )
        ) {
          const point =
            getPointerPosition(event);

          drawFreehandSegment(
            lastPointer,
            point
          );

          lastPointer = point;
        }
      }
    );

    window.addEventListener(
      "resize",
      debounce(() => {
        updateCropGeometry();
      }, 100)
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.ctrlKey ||
          event.metaKey
        ) {
          if (
            event.key.toLowerCase() ===
            "z"
          ) {
            event.preventDefault();

            if (event.shiftKey) {
              redo();
            } else {
              undo();
            }
          }

          if (
            event.key.toLowerCase() ===
            "y"
          ) {
            event.preventDefault();
            redo();
          }
        }
      }
    );
  }

  /* =========================================================
     ACTIVE BUTTON HELPER
     ========================================================= */

  function $$setActive(
    parent,
    selected
  ) {
    if (!parent || !selected) return;

    Array.from(
      parent.querySelectorAll(
        "[data-tool], [data-aspect]"
      )
    ).forEach(item => {
      item.classList.toggle(
        "is-active",
        item === selected
      );
    });
  }

  /* =========================================================
     DEBOUNCE
     ========================================================= */

  function debounce(
    callback,
    delay
  ) {
    let timer;

    return (...args) => {
      clearTimeout(timer);

      timer = setTimeout(
        () => callback(...args),
        delay
      );
    };
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    if (workspace) {
      workspace.hidden = true;
    }

    if (dropzone) {
      dropzone.hidden = false;
    }

    if (cropBox) {
      cropBox.hidden = true;
    }

    if (zoomLabel) {
      zoomLabel.textContent = "100%";
    }

    syncControls();
    setupEvents();

    if (tabs.length) {
      activateTab(
        tabs[0].dataset.tab ||
          "crop"
      );
    }

    updateHistoryButtons();
  }

  init();
})();
