import type {
  PptLayoutAnalysis,
  PptRawSlide,
  PptSlotTemplateJson,
  SlotFrame
} from "@/lib/admin/ppt-to-slot/types";

const overlayWidth = 1280;
const overlayHeight = 720;

type CanvasModule = typeof import("@napi-rs/canvas");
type CanvasContext = ReturnType<ReturnType<CanvasModule["createCanvas"]>["getContext"]>;

export async function renderPptSlotOverlay({
  analysis,
  slide,
  template
}: {
  analysis: PptLayoutAnalysis;
  slide: PptRawSlide;
  template: PptSlotTemplateJson;
}) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(overlayWidth, overlayHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, overlayWidth, overlayHeight);
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, overlayWidth - 1, overlayHeight - 1);

  for (const layer of slide.layers) {
    const frame = toPixels(layer.frame, slide.canvas);

    ctx.fillStyle = layer.type === "text" ? "rgba(15, 23, 42, 0.05)" : "rgba(148, 163, 184, 0.14)";
    ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
    ctx.lineWidth = 1;
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);
  }

  drawFrame({
    color: "#F59E0B",
    frame: analysis.safeArea,
    label: "safe area",
    lineWidth: 2,
    slideCanvas: slide.canvas,
    ctx
  });

  ctx.strokeStyle = "rgba(14, 165, 233, 0.28)";
  ctx.lineWidth = 1;
  for (const x of analysis.alignmentLines.x) {
    const px = (x / slide.canvas.w) * overlayWidth;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, overlayHeight);
    ctx.stroke();
  }
  for (const y of analysis.alignmentLines.y) {
    const py = (y / slide.canvas.h) * overlayHeight;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(overlayWidth, py);
    ctx.stroke();
  }

  for (const slot of Object.values(template.slots)) {
    drawFrame({
      color: "#0EA5E9",
      frame: slot.frame,
      label: slot.id,
      lineWidth: 3,
      slideCanvas: slide.canvas,
      ctx
    });
  }

  return await canvas.encode("png");
}

function drawFrame({
  color,
  ctx,
  frame,
  label,
  lineWidth,
  slideCanvas
}: {
  color: string;
  ctx: CanvasContext;
  frame: SlotFrame;
  label: string;
  lineWidth: number;
  slideCanvas: { h: number; w: number };
}) {
  const px = toPixels(frame, slideCanvas);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(px.x, px.y, px.w, px.h);
  ctx.fillStyle = color;
  ctx.font = "600 18px sans-serif";
  ctx.fillRect(px.x, Math.max(0, px.y - 26), Math.max(90, label.length * 11), 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, px.x + 8, Math.max(18, px.y - 8));
}

function toPixels(frame: SlotFrame, canvas: { h: number; w: number }) {
  return {
    h: (frame.h / canvas.h) * overlayHeight,
    w: (frame.w / canvas.w) * overlayWidth,
    x: (frame.x / canvas.w) * overlayWidth,
    y: (frame.y / canvas.h) * overlayHeight
  };
}
