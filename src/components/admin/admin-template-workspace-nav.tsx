"use client";

import {
  BadgeIcon,
  GalleryHorizontalEnd,
  LayoutTemplate,
  Minus,
  Navigation,
  PanelTop,
  Type,
  Shapes
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type TemplateWorkspaceNavItem = {
  href: string;
  icon: typeof LayoutTemplate;
  id:
    | "templates"
    | "icons"
    | "shapes"
    | "lines"
    | "textStyles"
    | "containers"
    | "navigation";
};

const templateWorkspaceNavItems: TemplateWorkspaceNavItem[] = [
  {
    href: "/admin/templates",
    icon: LayoutTemplate,
    id: "templates"
  },
  {
    href: "/admin/templates/icons",
    icon: BadgeIcon,
    id: "icons"
  },
  {
    href: "/admin/templates/shapes",
    icon: Shapes,
    id: "shapes"
  },
  {
    href: "/admin/templates/lines",
    icon: Minus,
    id: "lines"
  },
  {
    href: "/admin/templates/text-styles",
    icon: Type,
    id: "textStyles"
  },
  {
    href: "/admin/templates/containers",
    icon: PanelTop,
    id: "containers"
  },
  {
    href: "/admin/templates/navigation",
    icon: Navigation,
    id: "navigation"
  }
];

export function AdminTemplateWorkspaceNav({
  active
}: {
  active: TemplateWorkspaceNavItem["id"];
}) {
  const t = useTranslations("adminTemplateWorkspace");

  return (
    <nav
      aria-label={t("navAria")}
      className="grid gap-2 rounded-lg border border-border bg-surface p-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      {templateWorkspaceNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent",
              isActive && "bg-accent-soft text-accent-strong"
            )}
            href={item.href}
            key={item.id}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-background text-accent-strong">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {t(`nav.${item.id}.title`)}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-xs text-muted",
                  isActive && "text-accent-strong/80"
                )}
              >
                {t(`nav.${item.id}.body`)}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TemplateWorkspaceHeadingIcon({
  type
}: {
  type: TemplateWorkspaceNavItem["id"];
}) {
  const className = "size-5";

  if (type === "containers") {
    return <PanelTop className={className} aria-hidden="true" />;
  }

  if (type === "icons") {
    return <BadgeIcon className={className} aria-hidden="true" />;
  }

  if (type === "shapes") {
    return <Shapes className={className} aria-hidden="true" />;
  }

  if (type === "lines") {
    return <GalleryHorizontalEnd className={className} aria-hidden="true" />;
  }

  if (type === "navigation") {
    return <Navigation className={className} aria-hidden="true" />;
  }

  if (type === "textStyles") {
    return <Type className={className} aria-hidden="true" />;
  }

  return <LayoutTemplate className={className} aria-hidden="true" />;
}
