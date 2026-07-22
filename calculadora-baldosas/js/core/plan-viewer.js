/**
 * Visor del plano: zoom, arrastrar y rotar 360°.
 */
(function (global) {
  'use strict';

  function createPlanViewer(stageEl, canvasEl, controls = {}) {
    if (!stageEl || !canvasEl) return null;

    const state = { scale: 1, rotation: 0, tx: 0, ty: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const zoomLabel = controls.zoomLabel;
    const rotationRange = controls.rotationRange;
    const rotationValue = controls.rotationValue;

    function clampScale(s) {
      return Math.min(6, Math.max(0.35, s));
    }

    function applyTransform() {
      canvasEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale}) rotate(${state.rotation}deg)`;
      if (zoomLabel) zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
      if (rotationRange) rotationRange.value = String(((state.rotation % 360) + 360) % 360);
      if (rotationValue) rotationValue.textContent = `${Math.round(state.rotation)}°`;
    }

    function resetView() {
      state.scale = 1;
      state.rotation = 0;
      state.tx = 0;
      state.ty = 0;
      applyTransform();
    }

    function fitView() {
      const sw = stageEl.clientWidth;
      const sh = stageEl.clientHeight;
      const cw = parseFloat(canvasEl.dataset.logicalWidth) || canvasEl.offsetWidth;
      const ch = parseFloat(canvasEl.dataset.logicalHeight) || canvasEl.offsetHeight;
      if (!sw || !sh || !cw || !ch) {
        resetView();
        return;
      }
      const pad = 24;
      state.scale = clampScale(Math.min((sw - pad) / cw, (sh - pad) / ch, 1));
      state.rotation = 0;
      state.tx = 0;
      state.ty = 0;
      applyTransform();
    }

    function zoomBy(delta) {
      state.scale = clampScale(state.scale + delta);
      applyTransform();
    }

    function rotateBy(deg) {
      state.rotation += deg;
      applyTransform();
    }

    function setRotation(deg) {
      state.rotation = deg;
      applyTransform();
    }

    function onPointerDown(e) {
      if (stageEl.classList.contains('obstacle-mode')) return;
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      stageEl.classList.add('is-dragging');
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      state.tx += e.clientX - lastX;
      state.ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      applyTransform();
    }

    function onPointerUp() {
      dragging = false;
      stageEl.classList.remove('is-dragging');
    }

    function onWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      zoomBy(delta);
    }

    stageEl.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    stageEl.addEventListener('mouseleave', onPointerUp);

    stageEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onPointerDown(e.touches[0]);
    }, { passive: false });
    stageEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onPointerMove(e.touches[0]);
      }
    }, { passive: false });
    stageEl.addEventListener('touchend', onPointerUp);

    stageEl.addEventListener('wheel', onWheel, { passive: false });

    controls.zoomIn?.addEventListener('click', () => zoomBy(0.2));
    controls.zoomOut?.addEventListener('click', () => zoomBy(-0.2));
    controls.rotateLeft?.addEventListener('click', () => rotateBy(-15));
    controls.rotateRight?.addEventListener('click', () => rotateBy(15));
    controls.reset?.addEventListener('click', () => fitView());
    rotationRange?.addEventListener('input', () => setRotation(parseFloat(rotationRange.value) || 0));

    return { resetView, fitView, applyTransform };
  }

  global.PlanViewer = { createPlanViewer };
})(typeof window !== 'undefined' ? window : globalThis);
