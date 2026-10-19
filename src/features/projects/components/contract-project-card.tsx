import { ExternalLink, FileSignature } from "lucide-react";
import type { Project } from "../types";
import {
  ProjectCardContent,
  projectCardClassName,
} from "./project-card-content";

export function ContractProjectCard({
  projects,
}: Readonly<{ projects: readonly Project[] }>) {
  if (projects.length === 0) return null;
  return (
    <section aria-label="Contract Management" className={projectCardClassName}>
      <ProjectCardContent
        title="Contract Management"
        code="BO-CONTRACTS"
        icon={FileSignature}
        color="#263d88"
        description="Internal system for contract management, revenue, and expense settlements."
      >
        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <a
              key={project.project_code}
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-subtle px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              {project.project_code === "BO-CONTRACT" ? "Revenue" : "Expense"}
              <ExternalLink
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </ProjectCardContent>
    </section>
  );
}
