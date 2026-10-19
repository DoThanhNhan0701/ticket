import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const projectCardClassName =
  "group flex min-h-64 flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface ProjectCardContentProps {
  title: string;
  description: string;
  code: string;
  icon: LucideIcon;
  color: string;
  children: ReactNode;
}

export function ProjectCardContent({
  title,
  description,
  code,
  icon: Icon,
  color,
  children,
}: Readonly<ProjectCardContentProps>) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
          <Icon className="h-5 w-5" style={{ color }} aria-hidden="true" />
        </span>
        <Badge className="max-w-48 truncate font-mono">{code}</Badge>
      </div>
      <h2 className="text-base font-semibold leading-snug text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-auto pt-6">{children}</div>
    </>
  );
}
