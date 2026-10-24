import { useEffect } from "react";
import { useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import type { TemplateGroup } from "@/features/settings/schemas/template-schema";
import type { CreateRequestValues } from "../schemas/create-request-schema";

export function RequestRowsValidation({
  form,
  groups,
}: Readonly<{
  form: UseFormReturn<CreateRequestValues>;
  groups: TemplateGroup[];
}>) {
  const { isSubmitted } = useFormState({ control: form.control });
  const rows = useWatch({
    control: form.control,
    name: "rows",
    disabled: !isSubmitted,
  });
  useEffect(() => {
    // Keep cross-field/date validation live after submission without rerendering
    // the whole create form for each cell edit.
    if (isSubmitted) void form.trigger("rows");
  }, [rows, groups, isSubmitted, form]);
  return null;
}
