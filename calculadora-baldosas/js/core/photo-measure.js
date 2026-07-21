/**
 * Medición de m² sobre foto o video mediante puntos y escala de referencia.
 */
(function (global) {
  'use strict';

  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function polygonArea(points) {
    if (points.length < 3) return 0;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  function computeScale(refLengthM, refPointA, refPointB) {
    const px = dist(refPointA, refPointB);
    if (!px || !refLengthM) return null;
    return refLengthM / px;
  }

  function measureArea(points, scaleMPerPx) {
    if (!scaleMPerPx || points.length < 3) return { areaM2: 0, widthM: 0, lengthM: 0 };
    const areaPx = polygonArea(points);
    const areaM2 = areaPx * scaleMPerPx * scaleMPerPx;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const widthM = (maxX - minX) * scaleMPerPx;
    const lengthM = (maxY - minY) * scaleMPerPx;

    return { areaM2, widthM, lengthM };
  }

  function createMeasureSession(canvas, imageSource) {
    const ctx = canvas.getContext('2d');
    let img = null;
    let videoFrame = null;
    let mode = 'reference';
    let refPoints = [];
    let contourPoints = [];
    let refLengthM = 1;
    let scale = null;
    let dragIndex = -1;
    let onUpdate = null;

    function setImage(source) {
      if (source instanceof HTMLImageElement) {
        img = source;
        videoFrame = null;
      } else if (source instanceof HTMLCanvasElement) {
        videoFrame = source;
        img = null;
      }
      fitCanvas();
      redraw();
    }

    function fitCanvas() {
      const source = img || videoFrame;
      if (!source) return;
      const maxW = canvas.parentElement?.clientWidth || 600;
      const maxH = 400;
      const ratio = source.width / source.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      canvas.width = w;
      canvas.height = h;
    }

    function toCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function redraw() {
      const source = img || videoFrame;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!source) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      if (refPoints.length >= 1) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(refPoints[0].x, refPoints[0].y);
        if (refPoints.length === 2) ctx.lineTo(refPoints[1].x, refPoints[1].y);
        ctx.stroke();
        drawPoint(refPoints[0], '#fbbf24');
        if (refPoints[1]) drawPoint(refPoints[1], '#fbbf24');
      }

      if (contourPoints.length) {
        ctx.strokeStyle = '#22d3ee';
        ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(contourPoints[0].x, contourPoints[0].y);
        for (let i = 1; i < contourPoints.length; i++) {
          ctx.lineTo(contourPoints[i].x, contourPoints[i].y);
        }
        if (contourPoints.length >= 3) {
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
        contourPoints.forEach((p) => drawPoint(p, '#22d3ee'));
      }
    }

    function drawPoint(p, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function hitTest(points, coord, radius = 12) {
      for (let i = points.length - 1; i >= 0; i--) {
        if (dist(points[i], coord) <= radius) return i;
      }
      return -1;
    }

    function notify() {
      if (typeof onUpdate === 'function') onUpdate(getResult());
    }

    function getResult() {
      const measure = scale ? measureArea(contourPoints, scale) : { areaM2: 0, widthM: 0, lengthM: 0 };
      return {
        refLengthM,
        refPoints: [...refPoints],
        contourPoints: [...contourPoints],
        scale,
        ...measure,
        ready: scale !== null && contourPoints.length >= 3,
      };
    }

    function onPointerDown(e) {
      e.preventDefault();
      const coord = toCanvasCoords(e);

      if (mode === 'reference') {
        const hit = hitTest(refPoints, coord);
        if (hit >= 0) {
          dragIndex = hit;
          return;
        }
        if (refPoints.length < 2) {
          refPoints.push(coord);
          if (refPoints.length === 2) {
            scale = computeScale(refLengthM, refPoints[0], refPoints[1]);
            mode = 'contour';
          }
          redraw();
          notify();
        }
        return;
      }

      const hit = hitTest(contourPoints, coord);
      if (hit >= 0) {
        dragIndex = hit;
        return;
      }
      contourPoints.push(coord);
      redraw();
      notify();
    }

    function onPointerMove(e) {
      if (dragIndex < 0) return;
      const coord = toCanvasCoords(e);
      if (mode === 'reference') {
        refPoints[dragIndex] = coord;
        if (refPoints.length === 2) {
          scale = computeScale(refLengthM, refPoints[0], refPoints[1]);
        }
      } else {
        contourPoints[dragIndex] = coord;
      }
      redraw();
      notify();
    }

    function onPointerUp() {
      dragIndex = -1;
      notify();
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', (e) => onPointerDown(e.touches[0]), { passive: false });
    canvas.addEventListener('touchmove', (e) => onPointerMove(e.touches[0]), { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    if (imageSource) setImage(imageSource);

    return {
      setImage,
      setRefLength(m) {
        refLengthM = Math.max(0.01, m);
        if (refPoints.length === 2) {
          scale = computeScale(refLengthM, refPoints[0], refPoints[1]);
          notify();
        }
      },
      setMode(m) {
        mode = m;
        notify();
      },
      getMode: () => mode,
      hasImage: () => !!(img || videoFrame),
      resetReference() {
        refPoints = [];
        scale = null;
        redraw();
        notify();
      },
      resetContour() {
        contourPoints = [];
        redraw();
        notify();
      },
      resetAll() {
        refPoints = [];
        contourPoints = [];
        scale = null;
        mode = 'reference';
        redraw();
        notify();
      },
      clearImage() {
        img = null;
        videoFrame = null;
        refPoints = [];
        contourPoints = [];
        scale = null;
        mode = 'reference';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        notify();
      },
      undoContour() {
        contourPoints.pop();
        redraw();
        notify();
      },
      getResult,
      setOnUpdate(fn) {
        onUpdate = fn;
      },
      redraw,
    };
  }

  function captureVideoFrame(video) {
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return c;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  global.PhotoMeasure = {
    createMeasureSession,
    captureVideoFrame,
    loadImageFromFile,
    measureArea,
    computeScale,
    polygonArea,
  };
})(typeof window !== 'undefined' ? window : globalThis);
