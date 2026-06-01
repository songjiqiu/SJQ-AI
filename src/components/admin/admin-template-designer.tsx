"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowLeft,
  BringToFront,
  Copy,
  ImagePlus,
  LoaderCircle,
  Plus,
  Redo2,
  Save,
  SendToBack,
  Trash2,
  Undo2
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clampBounds,
  TemplateCanvas,
  TemplateElementIcon,
  type TemplateCanvasSlide
} from "@/components/admin/template-canvas";
import { Link } from "@/i18n/navigation";
import {
  pptTemplateCategoryIds,
  type PptTemplateCategoryId
} from "@/lib/admin/templates/categories";
import type { PptTemplateDto } from "@/lib/admin/templates/types";
import type {
  ImageLayerRequest,
  SlideElement
} from "@/lib/ai-deck/schema";
import { cn } from "@/lib/utils";

type AdminTemplateDesignerProps = {
  initialTemplate: PptTemplateDto;
};

type EditorState = {
  template: PptTemplateDto;
  selectedElementId: string | null;
};

type ErrorMessages = {
  accountDisabled: string;
  forbidden: string;
  generic: string;
  notFound: string;
  unauthorized: string;
  validation: string;
};

type TemplateTranslator = ReturnType<typeof useTranslations>;

const elementTypeOptions = [
  "text",
  "generatedImage",
  "shape",
  "icon",
  "chartPlaceholder"
] as const satisfies SlideElement["type"][];

const semanticTypeOptions = [
  "title",
  "subtitle",
  "body",
  "heroVisual",
  "supportingVisual",
  "accentShape",
  "icon",
  "chart",
  "card",
  "badge",
  "background",
  "footer"
] as const satisfies SlideElement["semanticType"][];

const imageTypeOptions = [
  "photo",
  "illustration",
  "icon",
  "diagram",
  "texture",
  "background",
  "cutout"
] as const satisfies ImageLayerRequest["imageType"][];

const aspectRatioOptions = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;

export function AdminTemplateDesigner({
  initialTemplate
}: AdminTemplateDesignerProps) {
  const t = useTranslations("adminTemplates");
  const [state, setState] = useState<EditorState>({
    template: initialTemplate,
    selectedElementId: initialTemplate.slide.elements[0]?.id ?? null
  });
  const [past, setPast] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const errorMessages = useMemo(
    () => ({
      accountDisabled: t("errors.accountDisabled"),
      forbidden: t("errors.forbidden"),
      generic: t("errors.generic"),
      notFound: t("errors.notFound"),
      unauthorized: t("errors.unauthorized"),
      validation: t("errors.validation")
    }),
    [t]
  );
  const template = state.template;
  const slide = template.slide;
  const selectedElement = slide.elements.find(
    (element) => element.id === state.selectedElementId
  );
  const selectedImageRequest =
    selectedElement?.imageRequestId
      ? slide.imageLayerRequests.find(
          (request) => request.id === selectedElement.imageRequestId
        )
      : undefined;

  function commit(next: EditorState) {
    setPast((current) => [...current, state].slice(-50));
    setFuture([]);
    setState(next);
  }

  function updateTemplate(patch: Partial<PptTemplateDto>) {
    commit({
      ...state,
      template: {
        ...template,
        ...patch
      }
    });
  }

  function updateSlide(nextSlide: TemplateCanvasSlide) {
    updateTemplate({
      slide: {
        ...nextSlide,
        imageLayerRequests: nextSlide.imageLayerRequests,
        elements: nextSlide.elements
      }
    });
  }

  function updateElement(
    elementId: string,
    patch: Partial<SlideElement>
  ) {
    updateSlide({
      ...slide,
      elements: slide.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              ...patch
            }
          : element
      )
    });
  }

  function addElement(type: SlideElement["type"] = "text") {
    const id = uniqueElementId(type);
    const imageRequestId = type === "generatedImage" ? `${id}-request` : undefined;
    const nextElement: SlideElement = {
      id,
      type,
      role: t(`elementTypes.${type}`),
      ...(type === "text" ? { content: t("designer.newTextContent") } : {}),
      bounds: { x: 1, y: 1, width: 3.2, height: 0.8 },
      editable: true,
      hierarchyLevel: 3,
      imageRequestId,
      semanticType: type === "chartPlaceholder" ? "chart" : type === "generatedImage" ? "heroVisual" : type === "shape" ? "accentShape" : "body",
      zIndex: nextZIndex(),
      styleNotes: t("designer.newElementNotes"),
      requiresImageGeneration: type === "generatedImage",
      ...(type === "text"
        ? {
            textStyle: {
              align: "left" as const,
              fontSize: 16,
              fontWeight: "regular" as const,
              lineHeight: 1.25,
              maxLines: 4
            }
          }
        : {})
    };
    const nextRequests =
      type === "generatedImage" && imageRequestId
        ? [
            ...slide.imageLayerRequests,
            createImageRequest(imageRequestId, id)
          ]
        : slide.imageLayerRequests;

    commit({
      selectedElementId: id,
      template: {
        ...template,
        slide: {
          ...slide,
          elements: [...slide.elements, nextElement],
          imageLayerRequests: nextRequests
        }
      }
    });
  }

  function duplicateElement(element: SlideElement) {
    const id = uniqueElementId(`${element.type}-copy`);
    const requestId = element.imageRequestId ? `${id}-request` : undefined;
    const request = element.imageRequestId
      ? slide.imageLayerRequests.find((item) => item.id === element.imageRequestId)
      : undefined;
    const nextElement = {
      ...element,
      id,
      bounds: clampBounds({
        ...element.bounds,
        x: element.bounds.x + 0.25,
        y: element.bounds.y + 0.25
      }),
      imageRequestId: requestId,
      zIndex: nextZIndex()
    };

    commit({
      selectedElementId: id,
      template: {
        ...template,
        slide: {
          ...slide,
          elements: [...slide.elements, nextElement],
          imageLayerRequests:
            request && requestId
              ? [
                  ...slide.imageLayerRequests,
                  {
                    ...request,
                    id: requestId,
                    elementId: id
                  }
                ]
              : slide.imageLayerRequests
        }
      }
    });
  }

  function deleteElement(element: SlideElement) {
    const remainingElements = slide.elements.filter((item) => item.id !== element.id);

    commit({
      selectedElementId: remainingElements[0]?.id ?? null,
      template: {
        ...template,
        slide: {
          ...slide,
          elements: remainingElements,
          imageLayerRequests: slide.imageLayerRequests.filter(
            (request) => request.elementId !== element.id
          )
        }
      }
    });
  }

  function updateImageRequest(
    requestId: string,
    patch: Partial<ImageLayerRequest>
  ) {
    updateSlide({
      ...slide,
      imageLayerRequests: slide.imageLayerRequests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              ...patch
            }
          : request
      )
    });
  }

  function undo() {
    const previous = past[past.length - 1];

    if (!previous) {
      return;
    }

    setFuture((current) => [state, ...current].slice(0, 50));
    setPast((current) => current.slice(0, -1));
    setState(previous);
  }

  function redo() {
    const next = future[0];

    if (!next) {
      return;
    }

    setPast((current) => [...current, state].slice(-50));
    setFuture((current) => current.slice(1));
    setState(next);
  }

  async function saveTemplate() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        body: JSON.stringify({
          category: template.category,
          customCategoryKey: template.customCategoryKey,
          customCategoryName: template.customCategoryName,
          description: template.description,
          isEnabled: template.isEnabled,
          name: template.name,
          slide: template.slide,
          sortOrder: template.sortOrder,
          tags: template.tags
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      setState({
        selectedElementId: state.selectedElementId,
        template: payload.template as PptTemplateDto
      });
      setPast([]);
      setFuture([]);
      toast.success(t("toast.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-[calc(100dvh-4rem-1px)] flex-col overflow-hidden">
      <header className="grid shrink-0 gap-3 border-b border-border bg-background px-4 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          href="/admin/templates"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("actions.backToTemplates")}
        </Link>
        <div className="min-w-0">
          <input
            aria-label={t("fields.name")}
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-base font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            onChange={(event) =>
              updateTemplate({
                name: event.target.value
              })
            }
            value={template.name}
          />
          <p className="mt-1 text-xs text-muted">
            {t("designer.meta", {
              category: t(`categories.${template.category}`),
              elements: slide.elements.length
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button
            disabled={past.length === 0}
            onClick={undo}
            type="button"
            variant="secondary"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            {t("actions.undo")}
          </Button>
          <Button
            disabled={future.length === 0}
            onClick={redo}
            type="button"
            variant="secondary"
          >
            <Redo2 className="size-4" aria-hidden="true" />
            {t("actions.redo")}
          </Button>
          <Button disabled={isSaving} onClick={() => void saveTemplate()} type="button">
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? t("actions.saving") : t("actions.save")}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 overflow-y-auto border-b border-border bg-surface p-3 lg:border-b-0 lg:border-r">
          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t("designer.layers")}
              </h2>
              <Button onClick={() => addElement("text")} size="sm" type="button">
                <Plus className="size-4" aria-hidden="true" />
                {t("actions.add")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {elementTypeOptions.map((type) => (
                <Button
                  key={type}
                  onClick={() => addElement(type)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <TemplateElementIcon type={type} />
                  {t(`elementTypes.${type}`)}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              {slide.elements
                .slice()
                .sort((first, second) => second.zIndex - first.zIndex)
                .map((element) => {
                  const selected = element.id === state.selectedElementId;

                  return (
                    <button
                      className={cn(
                        "grid gap-1 rounded-lg border border-border bg-background p-3 text-left transition hover:border-accent",
                        selected && "border-accent bg-accent-soft"
                      )}
                      key={element.id}
                      onClick={() =>
                        setState({
                          ...state,
                          selectedElementId: element.id
                        })
                      }
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                        <TemplateElementIcon type={element.type} />
                        <span className="truncate">{element.role}</span>
                      </span>
                      <span className="text-xs text-muted">
                        {t("designer.layerMeta", {
                          type: t(`elementTypes.${element.type}`),
                          zIndex: element.zIndex
                        })}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-y-auto bg-background p-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
            <Button
              disabled={!selectedElement}
              onClick={() => selectedElement && bringToFront(selectedElement)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <BringToFront className="size-4" aria-hidden="true" />
              {t("actions.bringToFront")}
            </Button>
            <Button
              disabled={!selectedElement}
              onClick={() => selectedElement && sendToBack(selectedElement)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <SendToBack className="size-4" aria-hidden="true" />
              {t("actions.sendToBack")}
            </Button>
            <Button
              disabled={!selectedElement}
              onClick={() => selectedElement && alignElement(selectedElement, "centerX")}
              size="sm"
              type="button"
              variant="secondary"
            >
              <AlignCenterHorizontal className="size-4" aria-hidden="true" />
              {t("actions.alignCenterX")}
            </Button>
            <Button
              disabled={!selectedElement}
              onClick={() => selectedElement && alignElement(selectedElement, "centerY")}
              size="sm"
              type="button"
              variant="secondary"
            >
              <AlignCenterVertical className="size-4" aria-hidden="true" />
              {t("actions.alignCenterY")}
            </Button>
          </div>
          <div className="grid min-h-0 place-items-center">
            <TemplateCanvas
              className="max-w-5xl"
              onChange={updateSlide}
              onSelectElement={(id) =>
                setState({
                  ...state,
                  selectedElementId: id
                })
              }
              selectedElementId={state.selectedElementId}
              slide={slide}
            />
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-border bg-surface p-3 lg:border-l lg:border-t-0">
          <div className="grid gap-4">
            <TemplateMetaPanel
              onChange={updateTemplate}
              template={template}
              t={t}
            />
            {selectedElement ? (
              <ElementPanel
                element={selectedElement}
                imageRequest={selectedImageRequest}
                onDelete={() => deleteElement(selectedElement)}
                onDuplicate={() => duplicateElement(selectedElement)}
                onElementChange={(patch) => updateElement(selectedElement.id, patch)}
                onImageRequestChange={(patch) => {
                  if (selectedImageRequest) {
                    updateImageRequest(selectedImageRequest.id, patch);
                  }
                }}
                t={t}
              />
            ) : (
              <section className="rounded-lg border border-border bg-background p-4 text-sm text-muted">
                {t("designer.noElementSelected")}
              </section>
            )}
          </div>
        </aside>
      </div>
    </main>
  );

  function nextZIndex() {
    return Math.min(
      100,
      Math.max(0, ...slide.elements.map((element) => element.zIndex)) + 1
    );
  }

  function uniqueElementId(seed: string) {
    const base = `${seed.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()
      .toString(36)
      .slice(-5)}`;
    let id = base;
    let index = 1;

    while (slide.elements.some((element) => element.id === id)) {
      id = `${base}-${index}`;
      index += 1;
    }

    return id;
  }

  function createImageRequest(requestId: string, elementId: string): ImageLayerRequest {
    return {
      id: requestId,
      elementId,
      purpose: t("designer.defaultImagePurpose"),
      imageType: "illustration",
      keywords: [template.name, t(`categories.${template.category}`)],
      prompt: t("designer.defaultImagePrompt"),
      negativePrompt: t("designer.defaultNegativePrompt"),
      avoid: t("designer.defaultNegativePrompt"),
      transparentBackground: true,
      aspectRatio: "16:9",
      visualNotes: t("designer.defaultImageNotes")
    };
  }

  function bringToFront(element: SlideElement) {
    updateElement(element.id, {
      zIndex: nextZIndex()
    });
  }

  function sendToBack(element: SlideElement) {
    updateElement(element.id, {
      zIndex: 0
    });
  }

  function alignElement(element: SlideElement, direction: "centerX" | "centerY") {
    updateElement(element.id, {
      bounds: clampBounds({
        ...element.bounds,
        ...(direction === "centerX"
          ? { x: (13.333 - element.bounds.width) / 2 }
          : { y: (7.5 - element.bounds.height) / 2 })
      })
    });
  }
}

function TemplateMetaPanel({
  onChange,
  t,
  template
}: {
  onChange: (patch: Partial<PptTemplateDto>) => void;
  t: TemplateTranslator;
  template: PptTemplateDto;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-background p-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t("designer.templateInfo")}
      </h2>
      <Field label={t("fields.category")}>
        <select
          className={fieldClassName}
          onChange={(event) =>
            onChange({
              category: event.target.value as PptTemplateCategoryId
            })
          }
          value={template.category}
        >
          {pptTemplateCategoryIds.map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category}`)}
            </option>
          ))}
        </select>
      </Field>
      <TextInput
        label={t("fields.description")}
        multiline
        onChange={(value) => onChange({ description: value })}
        value={template.description ?? ""}
      />
      <TextInput
        label={t("fields.tags")}
        onChange={(value) => onChange({ tags: parseLines(value) })}
        value={template.tags.join("\n")}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label={t("fields.sortOrder")}
          onChange={(value) => onChange({ sortOrder: Number(value) || 0 })}
          type="number"
          value={String(template.sortOrder)}
        />
        <label className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          <input
            checked={template.isEnabled}
            onChange={(event) => onChange({ isEnabled: event.target.checked })}
            type="checkbox"
          />
          {t("fields.isEnabled")}
        </label>
      </div>
    </section>
  );
}

function ElementPanel({
  element,
  imageRequest,
  onDelete,
  onDuplicate,
  onElementChange,
  onImageRequestChange,
  t
}: {
  element: SlideElement;
  imageRequest?: ImageLayerRequest;
  onDelete: () => void;
  onDuplicate: () => void;
  onElementChange: (patch: Partial<SlideElement>) => void;
  onImageRequestChange: (patch: Partial<ImageLayerRequest>) => void;
  t: TemplateTranslator;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("designer.elementInfo")}
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={onDuplicate} size="icon" title={t("actions.duplicate")} type="button" variant="secondary">
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          <Button onClick={onDelete} size="icon" title={t("actions.delete")} type="button" variant="ghost">
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("fields.elementType")}>
          <select
            className={fieldClassName}
            onChange={(event) =>
              onElementChange({
                type: event.target.value as SlideElement["type"],
                requiresImageGeneration: event.target.value === "generatedImage"
              })
            }
            value={element.type}
          >
            {elementTypeOptions.map((type) => (
              <option key={type} value={type}>
                {t(`elementTypes.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("fields.semanticType")}>
          <select
            className={fieldClassName}
            onChange={(event) =>
              onElementChange({
                semanticType: event.target.value as SlideElement["semanticType"]
              })
            }
            value={element.semanticType}
          >
            {semanticTypeOptions.map((type) => (
              <option key={type} value={type}>
                {t(`semanticTypes.${type}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <TextInput
        label={t("fields.role")}
        onChange={(value) => onElementChange({ role: value })}
        value={element.role}
      />
      <TextInput
        label={t("fields.content")}
        multiline
        onChange={(value) => onElementChange({ content: value })}
        value={element.content ?? ""}
      />
      <TextInput
        label={t("fields.styleNotes")}
        multiline
        onChange={(value) => onElementChange({ styleNotes: value })}
        value={element.styleNotes}
      />
      <div className="grid grid-cols-2 gap-3">
        {(["x", "y", "width", "height"] as const).map((field) => (
          <TextInput
            key={field}
            label={t(`bounds.${field}`)}
            onChange={(value) =>
              onElementChange({
                bounds: clampBounds({
                  ...element.bounds,
                  [field]: Number(value)
                })
              })
            }
            step="0.05"
            type="number"
            value={String(element.bounds[field])}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label={t("fields.zIndex")}
          onChange={(value) => onElementChange({ zIndex: Number(value) || 0 })}
          type="number"
          value={String(element.zIndex)}
        />
        <TextInput
          label={t("fields.hierarchyLevel")}
          onChange={(value) =>
            onElementChange({ hierarchyLevel: Number(value) || 3 })
          }
          type="number"
          value={String(element.hierarchyLevel)}
        />
      </div>
      <label className="flex gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <input
          checked={element.editable}
          onChange={(event) => onElementChange({ editable: event.target.checked })}
          type="checkbox"
        />
        {t("fields.editable")}
      </label>
      <label className="flex gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <input
          checked={element.requiresImageGeneration}
          onChange={(event) =>
            onElementChange({ requiresImageGeneration: event.target.checked })
          }
          type="checkbox"
        />
        {t("fields.requiresImageGeneration")}
      </label>

      <TextStylePanel
        element={element}
        onElementChange={onElementChange}
        t={t}
      />

      {imageRequest ? (
        <ImageRequestPanel
          imageRequest={imageRequest}
          onImageRequestChange={onImageRequestChange}
          t={t}
        />
      ) : element.type === "generatedImage" ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          <ImagePlus className="mr-2 inline size-4" aria-hidden="true" />
          {t("designer.missingImageRequest")}
        </p>
      ) : null}
    </section>
  );
}

function TextStylePanel({
  element,
  onElementChange,
  t
}: {
  element: SlideElement;
  onElementChange: (patch: Partial<SlideElement>) => void;
  t: TemplateTranslator;
}) {
  const textStyle = element.textStyle ?? {
    align: "left" as const,
    fontSize: 16,
    fontWeight: "regular" as const,
    lineHeight: 1.25,
    maxLines: 4
  };

  return (
    <details className="rounded-lg border border-border bg-surface p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {t("designer.textStyle")}
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label={t("fields.fontSize")}
            onChange={(value) =>
              onElementChange({
                textStyle: {
                  ...textStyle,
                  fontSize: Number(value) || 16
                }
              })
            }
            type="number"
            value={String(textStyle.fontSize)}
          />
          <TextInput
            label={t("fields.lineHeight")}
            onChange={(value) =>
              onElementChange({
                textStyle: {
                  ...textStyle,
                  lineHeight: Number(value) || 1.25
                }
              })
            }
            step="0.05"
            type="number"
            value={String(textStyle.lineHeight)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("fields.fontWeight")}>
            <select
              className={fieldClassName}
              onChange={(event) =>
                onElementChange({
                  textStyle: {
                    ...textStyle,
                    fontWeight: event.target.value as typeof textStyle.fontWeight
                  }
                })
              }
              value={textStyle.fontWeight}
            >
              {(["regular", "medium", "semibold", "bold"] as const).map(
                (weight) => (
                  <option key={weight} value={weight}>
                    {t(`fontWeights.${weight}`)}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label={t("fields.align")}>
            <select
              className={fieldClassName}
              onChange={(event) =>
                onElementChange({
                  textStyle: {
                    ...textStyle,
                    align: event.target.value as typeof textStyle.align
                  }
                })
              }
              value={textStyle.align}
            >
              {(["left", "center", "right"] as const).map((align) => (
                <option key={align} value={align}>
                  {t(`align.${align}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <TextInput
          label={t("fields.textColor")}
          onChange={(value) =>
            onElementChange({
              textStyle: {
                ...textStyle,
                color: value || undefined
              }
            })
          }
          value={textStyle.color ?? ""}
        />
      </div>
    </details>
  );
}

function ImageRequestPanel({
  imageRequest,
  onImageRequestChange,
  t
}: {
  imageRequest: ImageLayerRequest;
  onImageRequestChange: (patch: Partial<ImageLayerRequest>) => void;
  t: TemplateTranslator;
}) {
  return (
    <details className="rounded-lg border border-border bg-surface p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {t("designer.imageRequest")}
      </summary>
      <div className="mt-3 grid gap-3">
        <TextInput
          label={t("fields.imagePurpose")}
          onChange={(value) => onImageRequestChange({ purpose: value })}
          value={imageRequest.purpose}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("fields.imageType")}>
            <select
              className={fieldClassName}
              onChange={(event) =>
                onImageRequestChange({
                  imageType: event.target.value as ImageLayerRequest["imageType"]
                })
              }
              value={imageRequest.imageType}
            >
              {imageTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {t(`imageTypes.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("fields.aspectRatio")}>
            <select
              className={fieldClassName}
              onChange={(event) =>
                onImageRequestChange({
                  aspectRatio: event.target.value as ImageLayerRequest["aspectRatio"]
                })
              }
              value={imageRequest.aspectRatio}
            >
              {aspectRatioOptions.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <TextInput
          label={t("fields.keywords")}
          onChange={(value) => onImageRequestChange({ keywords: parseLines(value) })}
          value={imageRequest.keywords.join("\n")}
        />
        <TextInput
          label={t("fields.prompt")}
          multiline
          onChange={(value) => onImageRequestChange({ prompt: value })}
          value={imageRequest.prompt}
        />
        <TextInput
          label={t("fields.negativePrompt")}
          multiline
          onChange={(value) =>
            onImageRequestChange({
              avoid: value,
              negativePrompt: value
            })
          }
          value={imageRequest.negativePrompt}
        />
        <TextInput
          label={t("fields.visualNotes")}
          multiline
          onChange={(value) => onImageRequestChange({ visualNotes: value })}
          value={imageRequest.visualNotes}
        />
        <label className="flex gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <input
            checked={imageRequest.transparentBackground}
            onChange={(event) =>
              onImageRequestChange({
                transparentBackground: event.target.checked
              })
            }
            type="checkbox"
          />
          {t("fields.transparentBackground")}
        </label>
      </div>
    </details>
  );
}

function TextInput({
  label,
  multiline = false,
  onChange,
  step,
  type = "text",
  value
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  step?: string;
  type?: string;
  value: string;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          className={cn(fieldClassName, "min-h-20 resize-y py-2")}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className={fieldClassName}
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type={type}
          value={value}
        />
      )}
    </Field>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

const fieldClassName =
  "min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readApiError(response: Response, messages: ErrorMessages) {
  try {
    const payload = await response.json();
    const code = typeof payload.error === "string" ? payload.error : "";

    if (code === "UNAUTHORIZED") {
      return messages.unauthorized;
    }

    if (code === "FORBIDDEN") {
      return messages.forbidden;
    }

    if (code === "ACCOUNT_DISABLED") {
      return messages.accountDisabled;
    }

    if (code === "VALIDATION_FAILED") {
      return messages.validation;
    }

    if (code === "NOT_FOUND") {
      return messages.notFound;
    }

    return messages.generic;
  } catch {
    return messages.generic;
  }
}
