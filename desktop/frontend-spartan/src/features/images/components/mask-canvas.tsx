import { useCallback, useEffect, useRef, useState } from "react";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Which sides to grow when outpainting. */
export type ExtendSides = { left: boolean; right: boolean; top: boolean; bottom: boolean };

/** Redraw an image/canvas at (w, h). Clamps an outpaint source to a size the browser can back and the backend can decode. */
export function scaleToCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const dctx = dst.getContext("2d");
  if (!dctx) throw new Error("Could not scale the extended canvas");
  dctx.drawImage(source, 0, 0, w, h);
  return dst;
}

/**
 * Build the (image, mask) pair for outpaint by reusing the inpaint backend: grow the canvas by `pct` per dimension on the
 * selected sides, edge-bleed the original pixels in, and mask the new bands white with a small overlap so the seam blends.
 */
export async function buildOutpaint(
  src: string,
  sides: ExtendSides,
  pct: number,
): Promise<{ image: string; mask: string }> {
  const source = await loadImage(src);
  // Scale the SOURCE so the grown canvas fits MAX_SIDE before allocating: growing all four sides by 100% multiplies the area
  // by 9, and a canvas past the browser limit silently no-ops every drawImage. Also keeps both allocations under a gigabyte.
  const MAX_SIDE = 4096;
  const grow = (a: boolean, b: boolean) => 1 + (a ? pct / 100 : 0) + (b ? pct / 100 : 0);
  const fit = Math.min(
    1,
    MAX_SIDE /
      Math.max(
        source.naturalWidth * grow(sides.left, sides.right),
        source.naturalHeight * grow(sides.top, sides.bottom),
      ),
  );
  const w = fit < 1 ? Math.max(1, Math.floor(source.naturalWidth * fit)) : source.naturalWidth;
  const h = fit < 1 ? Math.max(1, Math.floor(source.naturalHeight * fit)) : source.naturalHeight;
  const img: CanvasImageSource = fit < 1 ? scaleToCanvas(source, w, h) : source;
  const px = Math.round((pct / 100) * w);
  const py = Math.round((pct / 100) * h);
  const l = sides.left ? px : 0;
  const r = sides.right ? px : 0;
  const t = sides.top ? py : 0;
  const b = sides.bottom ? py : 0;
  const nw = w + l + r;
  const nh = h + t + b;

  const ic = document.createElement("canvas");
  ic.width = nw;
  ic.height = nh;
  const ictx = ic.getContext("2d");
  if (!ictx) throw new Error("Could not build the extended canvas");
  ictx.drawImage(img, l, t, w, h); // original, centred by the chosen offsets
  // Edge-bleed: stretch the 1px border strips into each new band (and corners).
  if (l) ictx.drawImage(img, 0, 0, 1, h, 0, t, l, h);
  if (r) ictx.drawImage(img, w - 1, 0, 1, h, l + w, t, r, h);
  if (t) ictx.drawImage(img, 0, 0, w, 1, l, 0, w, t);
  if (b) ictx.drawImage(img, 0, h - 1, w, 1, l, t + h, w, b);
  if (l && t) ictx.drawImage(img, 0, 0, 1, 1, 0, 0, l, t);
  if (r && t) ictx.drawImage(img, w - 1, 0, 1, 1, l + w, 0, r, t);
  if (l && b) ictx.drawImage(img, 0, h - 1, 1, 1, 0, t + h, l, b);
  if (r && b) ictx.drawImage(img, w - 1, h - 1, 1, 1, l + w, t + h, r, b);

  const overlap = Math.round(Math.min(w, h) * 0.02);
  const ol = l ? overlap : 0;
  const or = r ? overlap : 0;
  const ot = t ? overlap : 0;
  const ob = b ? overlap : 0;
  const mc = document.createElement("canvas");
  mc.width = nw;
  mc.height = nh;
  const mctx = mc.getContext("2d");
  if (!mctx) throw new Error("Could not build the extend mask");
  mctx.fillStyle = "#ffffff"; // repaint everything...
  mctx.fillRect(0, 0, nw, nh);
  mctx.fillStyle = "#000000"; // ...except the kept original (inset by the seam overlap).
  mctx.fillRect(l + ol, t + ot, w - ol - or, h - ot - ob);

  // The pre-scale sizes the canvases to fit MAX_SIDE, but per-side rounding can overshoot past the backend's 4096px limit; trim the slack.
  const longest = Math.max(nw, nh);
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    const sw = Math.max(1, Math.round(nw * scale));
    const sh = Math.max(1, Math.round(nh * scale));
    return {
      image: scaleToCanvas(ic, sw, sh).toDataURL("image/png"),
      mask: scaleToCanvas(mc, sw, sh).toDataURL("image/png"),
    };
  }

  return { image: ic.toDataURL("image/png"), mask: mc.toDataURL("image/png") };
}

/**
 * A brush-based mask editor for inpainting: the source image with a paintable overlay, exporting a grayscale PNG mask at
 * the image's NATIVE resolution (white = repaint). `brushPct` sizes the brush as a fraction of the shorter side.
 */
export function MaskCanvas({
  image,
  brushPct,
  resetKey,
  onMaskChange,
}: {
  image: string;
  brushPct: number;
  resetKey: number;
  onMaskChange: (dataUrl: string | null) => void;
}) {
  const dispRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const dims = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  // (Re)initialise both canvases when the image changes or Clear is pressed: size to native pixels, reset to all-black.
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      dims.current = { w, h };
      const disp = dispRef.current;
      const mask = maskRef.current ?? document.createElement("canvas");
      maskRef.current = mask;
      if (!disp) return;
      disp.width = w;
      disp.height = h;
      mask.width = w;
      mask.height = h;
      const mctx = mask.getContext("2d");
      const dctx = disp.getContext("2d");
      if (!mctx || !dctx) return;
      mctx.fillStyle = "#000";
      mctx.fillRect(0, 0, w, h);
      dctx.clearRect(0, 0, w, h);
      setReady(true);
      onMaskChange(null);
    };
    img.src = image;
  }, [image, resetKey, onMaskChange]);

  const radius = useCallback(() => {
    const base = Math.min(dims.current.w, dims.current.h) || 1024;
    return Math.max(2, (brushPct / 100) * base);
  }, [brushPct]);

  const toNatural = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const disp = dispRef.current;
    if (!disp) return { x: 0, y: 0 };
    const rect = disp.getBoundingClientRect();
    const sx = dims.current.w / rect.width;
    const sy = dims.current.h / rect.height;
    return {
      x: Math.max(0, Math.min(dims.current.w, (e.clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(dims.current.h, (e.clientY - rect.top) * sy)),
    };
  };

  const stroke = (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
    const disp = dispRef.current;
    const mask = maskRef.current;
    if (!disp || !mask) return;
    const dctx = disp.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!dctx || !mctx) return;
    const r = radius();

    const draw = (ctx: CanvasRenderingContext2D, color: string) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (from) {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    draw(dctx, "rgba(255, 255, 255, 0.75)"); // visual feedback: bright semi-opaque white
    draw(mctx, "#ffffff"); // actual mask: pure white
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const p = toNatural(e);
    last.current = p;
    stroke(null, p);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = toNatural(e);
    stroke(last.current, p);
    last.current = p;
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const mask = maskRef.current;
    if (mask) onMaskChange(mask.toDataURL("image/png"));
  };

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-muted/30">
      <img
        src={image}
        alt="Inpaint source"
        className="block w-full select-none"
        draggable={false}
      />
      <canvas
        ref={dispRef}
        data-testid="mask-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      />
    </div>
  );
}
