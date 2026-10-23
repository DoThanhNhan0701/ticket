import { useWatch } from "react-hook-form";
import {
  requestAssignmentSchema,
  requestGeneralSchema,
} from "../schemas/create-request-schema";
import { validateDetailRows } from "../utils/request-detail-data";
import type { useCreateRequest } from "./use-create-request";

export function useRequestCreateSteps(
  model: ReturnType<typeof useCreateRequest>,
) {
  const values = useWatch({ control: model.form.control });
  const rows = useWatch({ control: model.form.control, name: "rows" });
  const general = Boolean(
    !model.groupNameError &&
    model.lookups.data &&
    model.types.data &&
    model.selectedType &&
    requestAssignmentSchema.safeParse(values).success,
  );
  const details = general && requestGeneralSchema.safeParse(values).success;
  const additional =
    details &&
    model.template.data &&
    !model.clone.loading &&
    !model.clone.error &&
    validateDetailRows(model.groups, rows).length === 0;
  return { general, details, additional };
}
