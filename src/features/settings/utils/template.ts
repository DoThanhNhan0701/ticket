import {
  cleanTemplateTitle,
  type TemplateField,
  type TemplateGroup,
} from "../schemas/template-schema";

export function moveTemplateItem<T>(
  items: readonly T[],
  from: number,
  to: number,
) {
  const copy = [...items];
  if (to >= 0 && to < copy.length)
    [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}

export function moveTemplateIndex(
  active: number | null,
  from: number,
  to: number,
) {
  if (active === from) return to;
  if (active === to) return from;
  return active;
}

export function removeTemplateIndex(active: number | null, removed: number) {
  if (active === null || active === removed) return null;
  return active > removed ? active - 1 : active;
}

function updateDateTargets(
  groups: readonly TemplateGroup[],
  targets: ReadonlyMap<string, string | null>,
): TemplateGroup[] {
  return groups.map((group) => ({
    ...group,
    children: group.children.map((field) => {
      const rule = field.validate;
      if (
        typeof rule !== "object" ||
        rule === null ||
        typeof rule.target !== "string"
      )
        return field;
      const target = cleanTemplateTitle(rule.target);
      if (!targets.has(target)) return field;
      const replacement = targets.get(target);
      return {
        ...field,
        validate: replacement ? { ...rule, target: replacement } : null,
      };
    }),
  }));
}

export function updateTemplateField(
  groups: readonly TemplateGroup[],
  groupIndex: number,
  fieldIndex: number,
  next: TemplateField,
): TemplateGroup[] {
  const previous = groups[groupIndex].children[fieldIndex];
  const wasDate = previous.type.includes("date");
  const isDate = next.type.includes("date");
  const updated = wasDate && !isDate ? { ...next, validate: null } : next;
  const changed = groups.map((group, index) =>
    index === groupIndex
      ? {
          ...group,
          children: group.children.map((field, position) =>
            position === fieldIndex ? updated : field,
          ),
        }
      : group,
  );
  const previousTitle = cleanTemplateTitle(previous.title);
  if (!wasDate || !previousTitle) return changed;
  const nextTitle = isDate ? cleanTemplateTitle(next.title) : null;
  if (previousTitle === nextTitle) return changed;
  return updateDateTargets(changed, new Map([[previousTitle, nextTitle]]));
}

export function removeTemplateField(
  groups: readonly TemplateGroup[],
  groupIndex: number,
  fieldIndex: number,
): TemplateGroup[] {
  const removed = groups[groupIndex].children[fieldIndex];
  const changed = groups.map((group, index) =>
    index === groupIndex
      ? {
          ...group,
          children: group.children.filter(
            (_, position) => position !== fieldIndex,
          ),
        }
      : group,
  );
  return updateDateTargets(
    changed,
    new Map([[cleanTemplateTitle(removed.title), null]]),
  );
}

export function removeTemplateGroup(
  groups: readonly TemplateGroup[],
  groupIndex: number,
): TemplateGroup[] {
  const targets = new Map(
    groups[groupIndex].children.map(
      (field) => [cleanTemplateTitle(field.title), null] as const,
    ),
  );
  return updateDateTargets(
    groups.filter((_, index) => index !== groupIndex),
    targets,
  );
}
