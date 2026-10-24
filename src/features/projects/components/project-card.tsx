import { t, useLocale } from "@/i18n";
import { ExternalLink } from "lucide-react";
import type { Project } from "../types";
import { getProjectIcon } from "../utils/project-icon";
import {
  ProjectCardContent,
  projectCardClassName,
} from "./project-card-content";

export function ProjectCard({ project }: Readonly<{ project: Project }>) {
  useLocale();
  return (
    <a
      href={project.href}
      aria-label={t("projects", "Open {0}", [project.name])}
      target="_blank"
      rel="noopener noreferrer"
      className={projectCardClassName}
    >
      <ProjectCardContent
        title={project.name}
        code={project.project_code}
        icon={getProjectIcon(project.icon, project.name)}
        color={project.bg}
        description={t(
          "projects",
          "Internal operations and workflow system for {0} built for Rainscales.",
          [project.name],
        )}
      >
        <span className="flex items-center justify-between border-t border-border pt-4 text-sm font-semibold text-brand-700 dark:text-brand-200">
          {" "}
          {t("projects", "Access Application")}{" "}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </span>
      </ProjectCardContent>
    </a>
  );
}
