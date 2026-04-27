/**
 * Pulse Session Overlay — standalone cross-site injector
 *
 * Usage (bookmarklet):
 *   javascript:fetch('http://localhost:5174/session-overlay.js').then(r=>r.text()).then(eval)
 *
 * Running the script again removes the overlay if already present (toggle).
 */
(function () {
  const HOST_ID = "__pulse_overlay_host__";

  // Toggle off if already mounted
  const existing = document.getElementById(HOST_ID);
  if (existing) { existing.remove(); return; }

  // ─── Constants ────────────────────────────────────────────────────────────────

  const PANEL_WIDTH    = 188;
  const PANEL_HEIGHT   = 60;  // approximate; used for snap math
  const INACTIVITY_MS  = 3000;
  const SNAP_THRESHOLD = 80;
  const SNAP_PAD       = 12;

  // ─── Shadow host ──────────────────────────────────────────────────────────────

  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    top:      "0",
    left:     "0",
    width:    "0",
    height:   "0",
    zIndex:   "2147483647",
    overflow: "visible",
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // ─── CSS ──────────────────────────────────────────────────────────────────────

  const style = document.createElement("style");
  style.textContent = `
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

    .overlay {
      position: fixed;
      user-select: none;
      touch-action: none;
      will-change: transform;
      transition: none;
    }

    .overlay.snapping {
      transition: transform 380ms cubic-bezier(0.22,1,0.36,1);
    }

    .fade-wrap {
      transition: opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.56,0.64,1);
    }

    .fade-wrap.hidden {
      opacity: 0;
      transform: scale(0.88) translateY(6px);
      pointer-events: none;
    }

    .fade-wrap.visible {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 12px;
      width: ${PANEL_WIDTH}px;
      background: rgba(10,12,16,0.82);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.09);
      border-top-color: rgba(255,255,255,0.16);
      border-radius: 999px;
      box-shadow:
        0 16px 48px rgba(0,0,0,0.50),
        0 4px 16px rgba(0,0,0,0.30),
        inset 0 1px 0 rgba(255,255,255,0.08);
      cursor: grab;
    }

    .pill.dragging { cursor: grabbing; }

    .divider {
      width: 1px;
      height: 20px;
      background: rgba(255,255,255,0.09);
      flex-shrink: 0;
    }

    .spacer { flex: 1; }

    button.ob {
      border-radius: 50%;
      border: 2px solid transparent;
      outline: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 150ms ease, color 150ms ease, transform 150ms ease, border-color 150ms ease;
    }

    button.ob:hover  { transform: scale(1.12); }
    button.ob:focus  { outline: none; }

    /* teal */
    button.ob.teal            { background: rgba(20,159,119,0.18); color: #34d399; width: 40px; height: 40px; }
    button.ob.teal:hover      { background: rgba(20,159,119,0.32); color: #fff; }
    button.ob.teal:focus      { border-color: rgba(20,159,119,0.6); }

    /* red */
    button.ob.red             { background: rgba(239,68,68,0.18);  color: #f87171; width: 40px; height: 40px; }
    button.ob.red:hover       { background: rgba(239,68,68,0.32);  color: #fff; }
    button.ob.red:focus       { border-color: rgba(239,68,68,0.6); }

    /* violet */
    button.ob.violet          { background: rgba(139,92,246,0.18); color: #c4b5fd; width: 40px; height: 40px; }
    button.ob.violet:hover    { background: rgba(139,92,246,0.32); color: #fff; }
    button.ob.violet:focus    { border-color: rgba(139,92,246,0.6); }

    /* ghost (close) */
    button.ob.ghost           { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.38); width: 32px; height: 32px; }
    button.ob.ghost:hover     { background: rgba(239,68,68,0.20);   color: #fca5a5; }
    button.ob.ghost:focus     { border-color: rgba(255,255,255,0.4); }

    svg { display: block; pointer-events: none; }
  `;
  shadow.appendChild(style);

  // ─── SVG icons ────────────────────────────────────────────────────────────────

  const SVG_MIC_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>`;

  const SVG_MIC_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z"/>
  </svg>`;

  const SVG_SPARKLE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1L9.5 8.5H2l6 4.4-2.3 7.1L12 15.5l6.3 4.5-2.3-7.1 6-4.4h-7.5z"/>
  </svg>`;

  const SVG_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>`;

  // ─── DOM ──────────────────────────────────────────────────────────────────────

  const overlay  = document.createElement("div");
  overlay.className = "overlay";

  const fadeWrap = document.createElement("div");
  fadeWrap.className = "fade-wrap visible";

  const pill = document.createElement("div");
  pill.className = "pill";
  pill.setAttribute("role", "toolbar");
  pill.setAttribute("aria-label", "Session controls");

  function makeBtn(variant, ariaLabel, innerHTML, size) {
    const btn = document.createElement("button");
    btn.className = `ob ${variant}`;
    btn.setAttribute("aria-label", ariaLabel);
    btn.style.width  = size + "px";
    btn.style.height = size + "px";
    btn.innerHTML = innerHTML;
    return btn;
  }

  const btnMic    = makeBtn("teal",   "Mute mic",        SVG_MIC_ON, 40);
  const btnAI     = makeBtn("violet", "Trigger AI Assist", SVG_SPARKLE, 40);
  const spacer    = document.createElement("div"); spacer.className = "spacer";
  const divider   = document.createElement("div"); divider.className = "divider";
  const btnClose  = makeBtn("ghost",  "Close overlay",   SVG_CLOSE, 32);

  pill.append(btnMic, btnAI, spacer, divider, btnClose);
  fadeWrap.appendChild(pill);
  overlay.appendChild(fadeWrap);
  shadow.appendChild(overlay);

  // ─── Position ─────────────────────────────────────────────────────────────────

  let posX = window.innerWidth  / 2 - PANEL_WIDTH / 2;
  let posY = window.innerHeight - 80;

  function applyPos() {
    overlay.style.transform = `translate(${posX}px, ${posY}px)`;
  }
  applyPos();

  // Entrance animation — flip visible after first frame
  overlay.style.opacity = "0";
  requestAnimationFrame(() => {
    overlay.style.opacity = "";
  });

  // ─── Drag ─────────────────────────────────────────────────────────────────────

  let dragging   = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let originX    = 0;
  let originY    = 0;

  pill.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    originX    = posX;
    originY    = posY;
    pill.setPointerCapture(e.pointerId);
    pill.classList.add("dragging");
    overlay.classList.remove("snapping");
    clearInactivityTimer();
    showOverlay();
    e.preventDefault();
  });

  pill.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    posX = originX + (e.clientX - dragStartX);
    posY = originY + (e.clientY - dragStartY);
    applyPos();
  });

  pill.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    pill.releasePointerCapture(e.pointerId);
    pill.classList.remove("dragging");
    snapToEdge();
    resetInactivityTimer();
  });

  function snapToEdge() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = PANEL_WIDTH;
    const h = PANEL_HEIGHT;

    if (posX < SNAP_THRESHOLD)              posX = SNAP_PAD;
    else if (posX + w > W - SNAP_THRESHOLD) posX = W - w - SNAP_PAD;
    if (posY < SNAP_THRESHOLD)              posY = SNAP_PAD;
    else if (posY + h > H - SNAP_THRESHOLD) posY = H - h - SNAP_PAD;

    overlay.classList.add("snapping");
    applyPos();
    overlay.addEventListener("transitionend", () => {
      overlay.classList.remove("snapping");
    }, { once: true });
  }

  // ─── Auto-hide ────────────────────────────────────────────────────────────────

  let hideTimer = null;

  function showOverlay() {
    fadeWrap.classList.remove("hidden");
    fadeWrap.classList.add("visible");
  }

  function hideOverlay() {
    if (dragging) return;
    fadeWrap.classList.remove("visible");
    fadeWrap.classList.add("hidden");
  }

  function clearInactivityTimer() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function resetInactivityTimer() {
    showOverlay();
    clearInactivityTimer();
    hideTimer = setTimeout(hideOverlay, INACTIVITY_MS);
  }

  document.addEventListener("mousemove", resetInactivityTimer);
  resetInactivityTimer();

  // ─── Mic toggle ───────────────────────────────────────────────────────────────

  let micOn = true;

  btnMic.addEventListener("click", () => {
    micOn = !micOn;
    btnMic.className        = `ob ${micOn ? "teal" : "red"}`;
    btnMic.style.width      = "40px";
    btnMic.style.height     = "40px";
    btnMic.innerHTML        = micOn ? SVG_MIC_ON : SVG_MIC_OFF;
    btnMic.setAttribute("aria-label", micOn ? "Mute mic" : "Unmute mic");
  });

  // ─── AI assist ────────────────────────────────────────────────────────────────

  btnAI.addEventListener("click", () => {
    console.log("[Pulse] AI assist triggered");
  });

  // ─── Close ────────────────────────────────────────────────────────────────────

  btnClose.addEventListener("click", () => {
    document.removeEventListener("mousemove", resetInactivityTimer);
    clearInactivityTimer();
    host.remove();
  });

})();
