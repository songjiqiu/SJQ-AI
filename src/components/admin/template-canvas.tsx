"use client";

import { Image as ImageIcon, Shapes, Type } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";

import type {
  GeneratedImageLayer,
  SlideCompositionPlan,
  SlideElement,
  SlideMotionPlan
} from "@/lib/ai-deck/schema";
import { cn } from "@/lib/utils";

export type TemplateCanvasSlide = SlideCompositionPlan & {
  generatedImageLayers?: GeneratedImageLayer[];
  motionPlan?: SlideMotionPlan;
};

type TemplateCanvasProps = {
  className?: string;
  disabled?: boolean;
  motionEnabled?: boolean;
  onChange?: (slide: TemplateCanvasSlide) => void;
  onSelectElement?: (id: string) => void;
  selectedElementId?: string | null;
  slide: TemplateCanvasSlide;
  variant?: "thumbnail" | "editor";
};

export function TemplateCanvas({
  className,
  disabled = false,
  motionEnabled = false,
  onChange,
  onSelectElement,
  selectedElementId = null,
  slide,
  variant = "editor"
}: TemplateCanvasProps) {
  const [dragState, setDragState] = useState<{
    elementId: string;
    mode: "move" | "resize";
    startBounds: SlideElement["bounds"];
    startX: number;
    startY: number;
  } | null>(null);
  const isThumbnail = variant === "thumbnail";

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface",
        !isThumbnail && "shadow-lg",
        className
      )}
      onPointerMove={(event) => {
        if (!dragState || disabled || !onChange) {
          return;
        }

        const canvas = event.currentTarget.getBoundingClientRect();
        const dx = ((event.clientX - dragState.startX) / canvas.width) * 13.333;
        const dy = ((event.clientY - dragState.startY) / canvas.height) * 7.5;

        onChange({
          ...slide,
          elements: slide.elements.map((element) =>
            element.id === dragState.elementId
              ? {
                  ...element,
                  bounds: clampBounds(
                    dragState.mode === "resize"
                      ? {
                          ...element.bounds,
                          width: dragState.startBounds.width + dx,
                          height: dragState.startBounds.height + dy
                        }
                      : {
                          ...element.bounds,
                          x: dragState.startBounds.x + dx,
                          y: dragState.startBounds.y + dy
                        }
                  )
                }
              : element
          )
        });
      }}
      onPointerUp={() => setDragState(null)}
    >
      {slide.elements
        .slice()
        .sort((first, second) => first.zIndex - second.zIndex)
        .map((element) => {
          const selected = selectedElementId === element.id;
          const layer = slide.generatedImageLayers?.find(
            (item) => item.requestId === element.imageRequestId
          );
          const motion = slide.motionPlan?.elements.find(
            (item) => item.elementId === element.id
          );
          const motionStyle = motionEnabled && motion ? getMotionStyle(motion) : {};
          const style = {
            left: `${toCanvasPercent(element.bounds.x, "x")}%`,
            top: `${toCanvasPercent(element.bounds.y, "y")}%`,
            width: `${toCanvasPercent(element.bounds.width, "x")}%`,
            height: `${toCanvasPercent(element.bounds.height, "y")}%`,
            zIndex: element.zIndex,
            ...elementAssetBoxStyle(element),
            ...elementTextStyle(element),
            ...motionStyle
          } satisfies CSSProperties;

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "absolute flex items-center justify-center overflow-hidden rounded-md border px-2 text-center text-xs font-medium leading-5 transition",
                element.type === "generatedImage" &&
                  "border-accent/50 bg-accent-soft text-accent-strong",
                element.type === "text" &&
                  "border-border bg-background text-foreground shadow-sm",
                element.type === "shape" &&
                  "border-transparent bg-accent/20 text-accent-strong",
                element.type === "chartPlaceholder" &&
                  "border-accent/40 bg-surface-muted text-accent-strong",
                element.type === "icon" &&
                  "border-accent/40 bg-accent-soft text-accent-strong",
                selected &&
                  "border-accent shadow-lg outline outline-2 outline-offset-2 outline-accent ring-4 ring-accent-soft",
                motionEnabled && motion && `ppt-motion ppt-motion-${motion.preset}`
              )}
              data-selected={selected ? "true" : undefined}
              data-testid={`template-canvas-element-${element.id}`}
              disabled={isThumbnail}
              key={element.id}
              onPointerDown={(event) => {
                if (disabled || isThumbnail) {
                  return;
                }

                event.currentTarget.setPointerCapture(event.pointerId);
                onSelectElement?.(element.id);
                setDragState({
                  elementId: element.id,
                  mode: event.altKey ? "resize" : "move",
                  startBounds: element.bounds,
                  startX: event.clientX,
                  startY: event.clientY
                });
              }}
              style={style}
              title={element.role}
              type="button"
            >
              {renderElementContent(element, layer, isThumbnail)}
              {selected ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-accent bg-accent/10"
                  data-testid={`template-canvas-highlight-${element.id}`}
                />
              ) : null}
            </button>
          );
        })}
    </div>
  );
}

export function TemplateElementIcon({
  type
}: {
  type: SlideElement["type"];
}) {
  const className = "size-3.5 text-accent";

  if (type === "text") {
    return <Type className={className} aria-hidden="true" />;
  }

  if (type === "generatedImage") {
    return <ImageIcon className={className} aria-hidden="true" />;
  }

  return <Shapes className={className} aria-hidden="true" />;
}

export function clampBounds(bounds: SlideElement["bounds"]) {
  const width = clamp(bounds.width, 0.05, 13.333);
  const height = clamp(bounds.height, 0.05, 7.5);
  const x = clamp(bounds.x, 0, 13.333 - width);
  const y = clamp(bounds.y, 0, 7.5 - height);

  return {
    x: roundCanvasValue(x),
    y: roundCanvasValue(y),
    width: roundCanvasValue(width),
    height: roundCanvasValue(height)
  };
}

function renderElementContent(
  element: SlideElement,
  layer: GeneratedImageLayer | undefined,
  isThumbnail: boolean
) {
  if (element.type === "generatedImage") {
    if (layer) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={element.role} className="size-full object-cover" src={layer.url} />
      );
    }

    return isThumbnail ? <ImageIcon className="size-5" aria-hidden="true" /> : element.role;
  }

  if (element.type === "text") {
    return element.content;
  }

  if (element.type === "chartPlaceholder") {
    return isThumbnail ? <Shapes className="size-5" aria-hidden="true" /> : element.role;
  }

  if (element.type === "icon") {
    return (
      <span
        aria-hidden="true"
        className="grid size-full place-items-center"
        data-asset-icon={element.assetStyle?.iconName ?? "semantic-icon"}
      >
        <Shapes className="size-4/5" />
      </span>
    );
  }

  return element.role;
}

function elementAssetBoxStyle(element: SlideElement): CSSProperties {
  const assetStyle = element.assetStyle;

  if (!assetStyle) {
    return {};
  }

  const borderColor = assetStyle.strokeColor;
  const borderWidth = assetStyle.strokeWidth;
  const isLine =
    element.assetBinding?.kind === "LINE" ||
    Boolean(assetStyle.lineType) ||
    element.bounds.height <= 0.18 ||
    element.bounds.width <= 0.18;

  if (isLine) {
    return {
      backgroundColor: assetStyle.strokeColor,
      borderColor: assetStyle.strokeColor,
      borderRadius: assetStyle.cornerRadius,
      borderStyle: assetStyle.dash === "dotted" ? "dotted" : assetStyle.dash === "dashed" ? "dashed" : "solid",
      borderWidth,
      color: assetStyle.strokeColor,
      opacity: assetStyle.opacity
    };
  }

  if (element.type === "text") {
    return {
      borderColor,
      borderRadius: assetStyle.cornerRadius,
      color: assetStyle.strokeColor
    };
  }

  return {
    backgroundColor:
      element.type === "icon" ? "transparent" : assetStyle.fillColor,
    borderColor,
    borderRadius: assetStyle.cornerRadius,
    borderStyle: assetStyle.dash === "dotted" ? "dotted" : assetStyle.dash === "dashed" ? "dashed" : "solid",
    borderWidth,
    color: assetStyle.strokeColor ?? assetStyle.activeColor,
    opacity: assetStyle.opacity
  };
}

function elementTextStyle(element: SlideElement): CSSProperties {
  const textStyle = element.textStyle;

  if (!textStyle) {
    return {};
  }

  return {
    color: textStyle.color,
    fontSize: `${textStyle.fontSize}px`,
    fontWeight: toCssFontWeight(textStyle.fontWeight),
    lineHeight: textStyle.lineHeight,
    textAlign: textStyle.align,
    whiteSpace: "pre-line"
  };
}

function toCssFontWeight(weight: NonNullable<SlideElement["textStyle"]>["fontWeight"]) {
  if (weight === "bold") {
    return 700;
  }

  if (weight === "semibold") {
    return 600;
  }

  if (weight === "medium") {
    return 500;
  }

  return 400;
}

function toCanvasPercent(value: number, axis: "x" | "y") {
  const max = axis === "x" ? 13.333 : 7.5;

  return (value / max) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundCanvasValue(value: number) {
  return Math.round(value * 100) / 100;
}

function getMotionStyle(motion: {
  delayMs: number;
  durationMs: number;
}): CSSProperties {
  return {
    "--ppt-motion-delay": `${motion.delayMs}ms`,
    "--ppt-motion-duration": `${motion.durationMs}ms`
  } as CSSProperties;
}
