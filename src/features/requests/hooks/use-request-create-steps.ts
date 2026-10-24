import { useWatch } from "react-hook-form";
import {
  requestAssignmentSchema,
  requestGeneralSchema,
  type CreateRequestValues,
} from "../schemas/create-request-schema";
import { validateDetailRows } from "../utils/request-detail-data";
import type { useCreateRequest } from "./use-create-request";

type Model = ReturnType<typeof useCreateRequest>;

function stepValidity(values: CreateRequestValues, groups: Model["groups"]) {
  return {
    assignment: requestAssignmentSchema.safeParse(values).success,
    general: requestGeneralSchema.safeParse(values).success,
    rows: validateDetailRows(groups, values.rows).length === 0,
  };
}

export function useRequestCreateSteps(model: Model) {
  // Only validity transitions should rerender the form shell, not every keypress.
  useWatch({
    control: model.form.control,
    compute: (values) => stepValidity(values, model.groups),
  });
  // Also recompute when catalogs/template change without a form-value event.
  const valid = stepValidity(model.form.getValues(), model.groups);
  const general = Boolean(
    !model.groupNameError &&
    model.lookups.data &&
    model.types.data &&
    model.selectedType &&
    valid.assignment,
  );
  const details = general && valid.general;
  const additional = Boolean(
    details &&
    model.template.data &&
    !model.clone.loading &&
    !model.clone.error &&
    valid.rows,
  );
  return { general, details, additional };
}
