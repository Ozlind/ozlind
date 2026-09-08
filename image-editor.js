(() => {
  "use strict";

  /* =========================================================
     OZLIND IMAGE EDITOR
     Compatible with current index.html + style.css
     ========================================================= */

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_DIMENSION = 2400;
  const MAX_HISTORY = 30;

  /* =========================================================
     DOM
     ========================================================= */

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));

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

  let beforeAfter = false;

  let rotation = 0;
  let flipX = 1;
  let flipY = 1;
  let straighten = 0;

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
     UTILS
     ========================================================= */

  function clamp(value, min, max) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function toast(message, type = "info") {
    const stack = $("#toastStack");

    if (!stack) {
      console.log(message);
      return;
    }

    const element = document.createElement("div");

    element.className =
      type === "error"
        ? "toast toast--error"
        : "toast";

    element.textContent = message;

    stack.appendChild(element);

    requestAnimationFrame(() => {
      element.classList.add("toast--show");
    });

    setTimeout(() => {
      element.classList.remove("toast--show");

      setTimeout(() => {
        element.remove();
      }, 220);
    }, 3000);
  }

  function createCanvas(width, height) {
    const c = document.createElement("canvas");

    c.width = Math.max(
      1,
      Math.round(width)
    );

    c.height = Math.max(
      1,
      Math.round(height)
    );

    return c;
  }

  function cloneCanvas(source) {
    const target = createCanvas(
      source.width,
      source.height
    );

    target
      .getContext("2d")
      .drawImage(source, 0, 0);

    return target;
  }

  function clearCanvas() {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
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

  /* =========================================================
     UI
     ========================================================= */

  function showWorkspace(show) {
    if (workspace) {
      workspace.hidden = !show;
    }

    if (dropzone) {
      dropzone.hidden = show;
    }
  }

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
    zoom = clamp(
      value,
      0.25,
      4
    );

    updateZoom();
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
     SNAPSHOTS
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
      straighten,

      adjustments: {
        ...adjustments
      },

      activeFilter,

      crop: {
        ...crop
      },

      textObjects:
        textObjects.map((item) => ({
          ...item
        }))
    };
  }

  function saveHistory() {
    const state = snapshot();

    if (!state) return;

    history =
      history.slice(
        0,
        historyIndex + 1
      );

    history.push(state);

    if (
      history.length >
      MAX_HISTORY
    ) {
      history.shift();
    }

    historyIndex =
      history.length - 1;

    updateHistoryButtons();
  }

  function restoreState(state) {
    if (!state?.canvas) {
      return;
    }

    canvas.width =
      state.canvas.width;

    canvas.height =
      state.canvas.height;

    clearCanvas();

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

    straighten =
      state.straighten || 0;

    adjustments = {
      ...state.adjustments
    };

    activeFilter =
      state.activeFilter ||
      "none";

    crop = {
      ...state.crop
    };

    textObjects =
      Array.isArray(state.textObjects)
        ? state.textObjects.map(
            (item) => ({
              ...item
            })
          )
        : [];

    syncControls();

    updateHistoryButtons();

    updateCropBox();
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
      historyIndex >=
        history.length - 1
    ) {
      return;
    }

    historyIndex++;

    restoreState(
      history[historyIndex]
    );
  }

  /* =========================================================
     IMAGE LOAD
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

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return "Maximum image size is 25 MB.";
    }

    return null;
  }

  function loadFile(file) {
    const error =
      validateFile(file);

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
        "Could not read the file.",
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
      originalCanvas.getContext(
        "2d"
      );

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

    clearCanvas();

    ctx.drawImage(
      originalCanvas,
      0,
      0
    );

    hasImage = true;

    rotation = 0;
    flipX = 1;
    flipY = 1;
    straighten = 0;

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

    zoom = 1;

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

    showWorkspace(true);

    syncControls();

    updateZoom();

    setupCropBox();

    saveHistory();

    toast("Image loaded successfully.");
  }

  /* =========================================================
     RENDER
     ========================================================= */

  function filterCSS() {
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
      ) * 100;

    const blur =
      Math.max(
        0,
        adjustments.blur
      );

    return [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      `brightness(${exposure}%)`,
      `blur(${blur}px)`
    ].join(" ");
  }

  function drawTransformedSource(target) {
    if (!originalCanvas) {
      return;
    }

    const width =
      originalCanvas.width;

    const height =
      originalCanvas.height;

    const angle =
      (rotation *
        Math.PI) /
      180;

    const swap =
      Math.abs(
        rotation % 180
      ) === 90;

    const outputWidth =
      swap ? height : width;

    const outputHeight =
      swap ? width : height;

    target.width =
      outputWidth;

    target.height =
      outputHeight;

    const targetCtx =
      target.getContext("2d");

    targetCtx.clearRect(
      0,
      0,
      outputWidth,
      outputHeight
    );

    targetCtx.save();

    targetCtx.translate(
      outputWidth / 2,
      outputHeight / 2
    );

    targetCtx.rotate(angle);

    targetCtx.scale(
      flipX,
      flipY
    );

    targetCtx.drawImage(
      originalCanvas,
      -width / 2,
      -height / 2,
      width,
      height
    );

    targetCtx.restore();
  }

  function renderFromOriginal() {
    if (!hasImage || !originalCanvas) {
      return;
    }

    const transformed =
      createCanvas(
        originalCanvas.width,
        originalCanvas.height
      );

    drawTransformedSource(
      transformed
    );

    canvas.width =
      transformed.width;

    canvas.height =
      transformed.height;

    clearCanvas();

    ctx.save();

    ctx.filter =
      filterCSS();

    ctx.drawImage(
      transformed,
      0,
      0
    );

    ctx.restore();

    applyFilterPixels();

    drawVignette();

    drawTextObjects();

    updateCropBox();
  }

  /* =========================================================
     PIXEL ADJUSTMENTS
     ========================================================= */

  function applyFilterPixels() {
    const temperature =
      adjustments.temperature;

    if (
      temperature === 0 &&
      activeFilter === "none" &&
      adjustments.sharpen <= 0
    ) {
      return;
    }

    let imageData;

    try {
      imageData =
        ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
    } catch {
      return;
    }

    const data =
      imageData.data;

    const temp =
      temperature / 100;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      if (temp !== 0) {
        data[i] =
          clamp(
            data[i] +
              35 * temp,
            0,
            255
          );

        data[i + 2] =
          clamp(
            data[i + 2] -
              35 * temp,
            0,
            255
          );
      }
    }

    ctx.putImageData(
      imageData,
      0,
      0
    );

    applyNamedFilter();

    if (
      adjustments.sharpen >
      0
    ) {
      sharpenImage();
    }
  }

  function applyNamedFilter() {
    if (
      activeFilter === "none"
    ) {
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

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (
        activeFilter === "mono"
      ) {
        const gray =
          0.299 * r +
          0.587 * g +
          0.114 * b;

        data[i] =
          gray;

        data[i + 1] =
          gray;

        data[i + 2] =
          gray;
      }

      if (
        activeFilter === "sepia"
      ) {
        data[i] =
          clamp(
            r * 0.393 +
              g * 0.769 +
              b * 0.189,
            0,
            255
          );

        data[i + 1] =
          clamp(
            r * 0.349 +
              g * 0.686 +
              b * 0.168,
            0,
            255
          );

        data[i + 2] =
          clamp(
            r * 0.272 +
              g * 0.534 +
              b * 0.131,
            0,
            255
          );
      }

      if (
        activeFilter === "warm"
      ) {
        data[i] =
          clamp(r + 18, 0, 255);

        data[i + 2] =
          clamp(b - 12, 0, 255);
      }

      if (
        activeFilter === "cool"
      ) {
        data[i] =
          clamp(r - 12, 0, 255);

        data[i + 2] =
          clamp(b + 18, 0, 255);
      }

      if (
        activeFilter === "vivid"
      ) {
        data[i] =
          clamp(
            (r - 128) * 1.2 +
              128,
            0,
            255
          );

        data[i + 1] =
          clamp(
            (g - 128) * 1.2 +
              128,
            0,
            255
          );

        data[i + 2] =
          clamp(
            (b - 128) * 1.2 +
              128,
            0,
            255
          );
      }

      if (
        activeFilter === "vintage"
      ) {
        data[i] =
          clamp(
            r * 1.05 + 10,
            0,
            255
          );

        data[i + 1] =
          clamp(
            g * 0.95 + 5,
            0,
            255
          );

        data[i + 2] =
          clamp(
            b * 0.85,
            0,
            255
          );
      }

      if (
        activeFilter === "cinematic"
      ) {
        data[i] =
          clamp(
            r * 1.06,
            0,
            255
          );

        data[i + 1] =
          clamp(
            g * 0.98,
            0,
            255
          );

        data[i + 2] =
          clamp(
            b * 0.92,
            0,
            255
          );
      }
    }

    ctx.putImageData(
      imageData,
      0,
      0
    );
  }

  function sharpenImage() {
    const amount =
      clamp(
        adjustments.sharpen /
          100,
        0,
        1
      );

    if (amount <= 0) {
      return;
    }

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const source =
      imageData.data;

    const result =
      new Uint8ClampedArray(
        source
      );

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
          const center =
            source[
              index + channel
            ];

          const left =
            source[
              index -
                4 +
                channel
            ];

          const right =
            source[
              index +
                4 +
                channel
            ];

          const top =
            source[
              index -
                width * 4 +
                channel
            ];

          const bottom =
            source[
              index +
                width * 4 +
                channel
            ];

          const sharp =
            center * 5 -
            left -
            right -
            top -
            bottom;

          result[
            index + channel
          ] =
            clamp(
              center +
                (sharp - center) *
                  amount *
                  0.35,
              0,
              255
            );
        }
      }
    }

    imageData.data.set(
      result
    );

    ctx.putImageData(
      imageData,
      0,
      0
    );
  }

  function drawVignette() {
    const amount =
      adjustments.vignette /
      100;

    if (amount <= 0) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    const gradient =
      ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.15,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.72
      );

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      `rgba(0,0,0,${clamp(
        amount * 0.8,
        0,
        0.8
      )})`
    );

    ctx.save();

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      w,
      h
    );

    ctx.restore();
  }

  /* =========================================================
     TEXT
     ========================================================= */

  function drawTextObjects() {
    if (
      !textObjects.length
    ) {
      return;
    }

    ctx.save();

    textObjects.forEach(
      (item) => {
        ctx.font =
          `${item.size}px sans-serif`;

        ctx.fillStyle =
          item.color;

        ctx.textAlign =
          "center";

        ctx.textBaseline =
          "middle";

        ctx.shadowColor =
          "rgba(0,0,0,.35)";

        ctx.shadowBlur = 3;

        ctx.fillText(
          item.text,
          item.x,
          item.y
        );
      }
    );

    ctx.restore();
  }

  function addText() {
    if (!hasImage) {
      toast(
        "Upload an image first.",
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
        textSize?.value || 48
      );

    const color =
      textColor?.value ||
      "#ffffff";

    textObjects.push({
      text,
      size,
      color,
      x: canvas.width / 2,
      y: canvas.height / 2
    });

    renderFromOriginal();

    saveHistory();

    textInput.value = "";

    toast("Text added.");
  }

  /* =========================================================
     CROP
     ========================================================= */

  function setupCropBox() {
    if (!cropBox) {
      return;
    }

    cropBox.hidden =
      !hasImage;

    updateCropBox();
  }

  function updateCropBox() {
    if (
      !cropBox ||
      !hasImage
    ) {
      return;
    }

    if (!crop.active) {
      cropBox.hidden = true;
      return;
    }

    cropBox.hidden = false;

    cropBox.style.left =
      `${crop.x}px`;

    cropBox.style.top =
      `${crop.y}px`;

    cropBox.style.width =
      `${crop.width}px`;

    cropBox.style.height =
      `${crop.height}px`;
  }

  function activateCrop() {
    if (!hasImage) {
      return;
    }

    crop.active = true;

    crop.x = 0;
    crop.y = 0;

    crop.width =
      canvas.width;

    crop.height =
      canvas.height;

    updateCropBox();
  }

  function applyCrop() {
    if (
      !hasImage ||
      !crop.active
    ) {
      return;
    }

    const x =
      clamp(
        Math.round(crop.x),
        0,
        canvas.width - 1
      );

    const y =
      clamp(
        Math.round(crop.y),
        0,
        canvas.height - 1
      );

    const width =
      clamp(
        Math.round(crop.width),
        1,
        canvas.width - x
      );

    const height =
      clamp(
        Math.round(crop.height),
        1,
        canvas.height - y
      );

    const temp =
      createCanvas(
        width,
        height
      );

    temp
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

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      temp,
      0,
      0
    );

    crop.active = false;

    updateCropBox();

    saveHistory();

    toast("Crop applied.");
  }

  /* =========================================================
     ROTATION / FLIP
     ========================================================= */

  function rotate(degrees) {
    if (!hasImage) {
      return;
    }

    rotation =
      (rotation + degrees) %
      360;

    if (rotation < 0) {
      rotation += 360;
    }

    renderFromOriginal();

    saveHistory();
  }

  function flipHorizontal() {
    if (!hasImage) {
      return;
    }

    flipX *= -1;

    renderFromOriginal();

    saveHistory();
  }

  function flipVertical() {
    if (!hasImage) {
      return;
    }

    flipY *= -1;

    renderFromOriginal();

    saveHistory();
  }

  /* =========================================================
     RESET
     ========================================================= */

  function resetEditor() {
    if (
      !hasImage ||
      !originalCanvas
    ) {
      return;
    }

    rotation = 0;
    flipX = 1;
    flipY = 1;
    straighten = 0;

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

    crop.active = false;

    renderFromOriginal();

    saveHistory();

    syncControls();

    toast("Editor reset.");
  }

  /* =========================================================
     BEFORE / AFTER
     ========================================================= */

  function toggleBeforeAfter() {
    if (
      !hasImage ||
      !originalCanvas
    ) {
      return;
    }

    beforeAfter =
      !beforeAfter;

    if (beforeAfter) {
      canvas.width =
        originalCanvas.width;

      canvas.height =
        originalCanvas.height;

      clearCanvas();

      ctx.drawImage(
        originalCanvas,
        0,
        0
      );

      if (beforeAfterButton) {
        beforeAfterButton.setAttribute(
          "aria-pressed",
          "true"
        );
      }

      toast("Showing original.");
    } else {
      renderFromOriginal();

      if (beforeAfterButton) {
        beforeAfterButton.setAttribute(
          "aria-pressed",
          "false"
        );
      }

      toast("Showing edited image.");
    }
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function pointerPosition(event) {
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
        (event.clientX -
          rect.left) *
        scaleX,

      y:
        (event.clientY -
          rect.top) *
        scaleY
    };
  }

  function drawStart(event) {
    if (
      !hasImage ||
      beforeAfter
    ) {
      return;
    }

    const point =
      pointerPosition(event);

    draw.drawing = true;

    draw.startX =
      point.x;

    draw.startY =
      point.y;

    draw.currentX =
      point.x;

    draw.currentY =
      point.y;

    canvas.setPointerCapture?.(
      event.pointerId
    );
  }

  function drawMove(event) {
    if (!draw.drawing) {
      return;
    }

    const point =
      pointerPosition(event);

    draw.currentX =
      point.x;

    draw.currentY =
      point.y;

    renderFromOriginal();

    drawPreview(
      draw.startX,
      draw.startY,
      draw.currentX,
      draw.currentY
    );
  }

  function drawEnd() {
    if (!draw.drawing) {
      return;
    }

    draw.drawing = false;

    const x1 =
      draw.startX;

    const y1 =
      draw.startY;

    const x2 =
      draw.currentX;

    const y2 =
      draw.currentY;

    renderFromOriginal();

    drawPermanent(
      x1,
      y1,
      x2,
      y2
    );

    saveHistory();
  }

  function drawPermanent(
    x1,
    y1,
    x2,
    y2
  ) {
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

    if (
      draw.tool === "eraser"
    ) {
      ctx.globalCompositeOperation =
        "destination-out";
    }

    if (
      draw.tool === "brush" ||
      draw.tool === "eraser"
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x1,
        y1
      );

      ctx.lineTo(
        x2,
        y2
      );

      ctx.stroke();
    }

    if (
      draw.tool === "line"
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x1,
        y1
      );

      ctx.lineTo(
        x2,
        y2
      );

      ctx.stroke();
    }

    if (
      draw.tool === "rect"
    ) {
      ctx.strokeRect(
        x1,
        y1,
        x2 - x1,
        y2 - y1
      );
    }

    if (
      draw.tool === "circle"
    ) {
      const dx =
        x2 - x1;

      const dy =
        y2 - y1;

      const radius =
        Math.sqrt(
          dx * dx +
            dy * dy
        );

      ctx.beginPath();

      ctx.arc(
        x1,
        y1,
        radius,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPreview(
    x1,
    y1,
    x2,
    y2
  ) {
    ctx.save();

    ctx.strokeStyle =
      draw.color;

    ctx.lineWidth =
      draw.size;

    ctx.lineCap =
      "round";

    ctx.setLineDash([
      6,
      5
    ]);

    if (
      draw.tool === "line" ||
      draw.tool === "brush"
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x1,
        y1
      );

      ctx.lineTo(
        x2,
        y2
      );

      ctx.stroke();
    }

    if (
      draw.tool === "rect"
    ) {
      ctx.strokeRect(
        x1,
        y1,
        x2 - x1,
        y2 - y1
      );
    }

    if (
      draw.tool === "circle"
    ) {
      const dx =
        x2 - x1;

      const dy =
        y2 - y1;

      const radius =
        Math.sqrt(
          dx * dx +
            dy * dy
        );

      ctx.beginPath();

      ctx.arc(
        x1,
        y1,
        radius,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  /* =========================================================
     DOWNLOAD
     ========================================================= */

  function downloadImage() {
    if (!hasImage) {
      toast(
        "Upload an image first.",
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
      output.getContext(
        "2d"
      );

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
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href = url;
        link.download =
          `ozlind-edit-${Date.now()}.png`;

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(
            url
          );
        }, 1000);

        toast(
          "Image downloaded."
        );
      },
      "image/png"
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function fullscreen() {
    const target =
      workspace ||
      canvasWrap;

    if (!target) {
      return;
    }

    try {
      if (
        !document.fullscreenElement
      ) {
        await target.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      toast(
        "Fullscreen is not available.",
        "error"
      );
    }
  }

  /* =========================================================
     CONTROLS SYNC
     ========================================================= */

  function syncControls() {
    adjustControls.forEach(
      (control) => {
        const key =
          control.dataset.adjust;

        if (
          !key ||
          !(key in adjustments)
        ) {
          return;
        }

        control.value =
          adjustments[key];
      }
    );

    if (
      straightenSlider
    ) {
      straightenSlider.value =
        straighten;
    }

    if (
      brushColor
    ) {
      brushColor.value =
        draw.color;
    }

    if (
      brushSize
    ) {
      brushSize.value =
        draw.size;
    }

    if (
      brushSizeValue
    ) {
      brushSizeValue.textContent =
        `${draw.size}px`;
    }

    if (
      textSizeValue &&
      textSize
    ) {
      textSizeValue.textContent =
        `${textSize.value}px`;
    }

    filterButtons.forEach(
      (button) => {
        const active =
          button.dataset.filter ===
          activeFilter;

        button.classList.toggle(
          "is-active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  uploadButton?.addEventListener(
    "click",
    () => {
      fileInput?.click();
    }
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
        "is-dragover"
      );
    }
  );

  dropzone?.addEventListener(
    "dragleave",
    () => {
      dropzone.classList.remove(
        "is-dragover"
      );
    }
  );

  dropzone?.addEventListener(
    "drop",
    (event) => {
      event.preventDefault();

      dropzone.classList.remove(
        "is-dragover"
      );

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        loadFile(file);
      }
    }
  );


  /* TABS */

  tabs.forEach(
    (tab) => {
      tab.addEventListener(
        "click",
        () => {
          const name =
            tab.dataset.tab;

          tabs.forEach(
            (item) => {
              item.classList.toggle(
                "is-active",
                item === tab
              );

              item.setAttribute(
                "aria-selected",
                String(
                  item === tab
                )
              );
            }
          );

          panels.forEach(
            (panel) => {
              panel.hidden =
                panel.dataset.panel !==
                name;
            }
          );

          if (
            name === "crop"
          ) {
            activateCrop();
          }
        }
      );
    }
  );


  /* ADJUSTMENTS */

  adjustControls.forEach(
    (control) => {
      control.addEventListener(
        "input",
        () => {
          const key =
            control.dataset.adjust;

          if (
            !key ||
            !(key in adjustments)
          ) {
            return;
          }

          adjustments[key] =
            Number(
              control.value
            );

          renderFromOriginal();
        }
      );

      control.addEventListener(
        "change",
        () => {
          saveHistory();
        }
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
              const active =
                item === button;

              item.classList.toggle(
                "is-active",
                active
              );

              item.setAttribute(
                "aria-pressed",
                String(active)
              );
            }
          );

          renderFromOriginal();

          saveHistory();
        }
      );
    }
  );


  /* CROP */

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

      crop.aspect =
        button.dataset.aspect ||
        "free";

      $$("#aspectGroup [data-aspect]")
        .forEach((item) => {
          item.classList.toggle(
            "is-active",
            item === button
          );

          item.setAttribute(
            "aria-pressed",
            String(
              item === button
            )
          );
        });

      activateCrop();
    }
  );

  applyCropButton?.addEventListener(
    "click",
    applyCrop
  );


  /* ROTATION */

  rotateLeftButton?.addEventListener(
    "click",
    () => {
      rotate(-90);
    }
  );

  rotateRightButton?.addEventListener(
    "click",
    () => {
      rotate(90);
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
    () => {
      straighten =
        Number(
          straightenSlider.value
        );

      rotation =
        straighten;

      renderFromOriginal();
    }
  );

  straightenSlider?.addEventListener(
    "change",
    saveHistory
  );


  /* ZOOM */

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


  /* BEFORE / AFTER */

  beforeAfterButton?.addEventListener(
    "click",
    toggleBeforeAfter
  );


  /* RESET */

  resetButton?.addEventListener(
    "click",
    resetEditor
  );


  /* DRAW */

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

      $$(
        "#drawToolGroup [data-draw-tool]"
      ).forEach(
        (item) => {
          item.classList.toggle(
            "is-active",
            item === button
          );

          item.setAttribute(
            "aria-pressed",
            String(
              item === button
            )
          );
        }
      );
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
          Number(
            brushSize.value
          ),
          1,
          100
        );

      if (
        brushSizeValue
      ) {
        brushSizeValue.textContent =
          `${draw.size}px`;
      }
    }
  );

  canvas.addEventListener(
    "pointerdown",
    drawStart
  );

  canvas.addEventListener(
    "pointermove",
    drawMove
  );

  canvas.addEventListener(
    "pointerup",
    drawEnd
  );

  canvas.addEventListener(
    "pointercancel",
    drawEnd
  );


  /* TEXT */

  textSize?.addEventListener(
    "input",
    () => {
      if (
        textSizeValue
      ) {
        textSizeValue.textContent =
          `${textSize.value}px`;
      }
    }
  );

  addTextButton?.addEventListener(
    "click",
    addText
  );


  /* DOWNLOAD */

  downloadButton?.addEventListener(
    "click",
    downloadImage
  );


  /* FULLSCREEN */

  fullscreenButton?.addEventListener(
    "click",
    fullscreen
  );


  /* UNDO / REDO */

  undoButton?.addEventListener(
    "click",
    undo
  );

  redoButton?.addEventListener(
    "click",
    redo
  );


  /* =========================================================
     KEYBOARD SHORTCUTS
     ========================================================= */

  document.addEventListener(
    "keydown",
    (event) => {
      const modifier =
        event.ctrlKey ||
        event.metaKey;

      if (
        modifier &&
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
        modifier &&
        event.key.toLowerCase() ===
          "y"
      ) {
        event.preventDefault();

        redo();
      }

      if (
        modifier &&
        event.key.toLowerCase() ===
          "s"
      ) {
        event.preventDefault();

        downloadImage();
      }
    }
  );


  /* =========================================================
     INITIAL
     ========================================================= */

  showWorkspace(false);

  updateZoom();

  updateHistoryButtons();

  syncControls();

  console.log(
    "Ozlind Image Editor initialized."
  );

})();
