import { useEffect, useMemo, useRef, useState } from "react";
import { addBusinessDays, format } from "date-fns";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthContext } from "@/features/auth/hooks/use-auth-context";
import { getRequestTemplate } from "@/features/settings/api/template-api";
import { prepareTemplate } from "@/features/settings/schemas/template-schema";
import { normalizeSearchText } from "@/lib/search";
import { useCloneRequest } from "./use-clone-request";
import {
  emptyDetailRow,
  getCreateRequestGroups,
} from "../utils/request-detail-data";
import {
  createRequest,
  getCreateRequestLookups,
  getCreateRequestTypes,
  uploadRequestAttachment,
} from "../api/create-request-api";
import {
  getCreateRequestSchema,
  type CreatedRequest,
  type CreateRequestValues,
} from "../schemas/create-request-schema";

function defaults(company = ""): CreateRequestValues {
  return {
    handling_group: "",
    ticket_type: "",
    approve_user: "",
    fore_cus: company,
    bophansudung: "",
    other1: [],
    vanphong: "",
    title: "",
    description: "",
    duedate: format(addBusinessDays(new Date(), 5), "dd/MM/yyyy"),
    rows: [{ values: {} }],
  };
}
export function useCreateRequest() {
  const { userId } = useAuthContext();
  const navigate = useNavigate(),
    client = useQueryClient();
  const lookups = useQuery({
    queryKey: ["request-create-lookups", userId],
    queryFn: ({ signal }) => getCreateRequestLookups(signal),
    retry: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<CreatedRequest>();
  const createdRef = useRef<CreatedRequest | undefined>(undefined),
    submitting = useRef(false),
    pendingFiles = useRef<File[]>([]);
  const form = useForm<CreateRequestValues>({
    resolver: zodResolver(getCreateRequestSchema([], lookups.data?.groups)),
    defaultValues: defaults(),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });
  const group = useWatch({ control: form.control, name: "handling_group" }),
    type = useWatch({ control: form.control, name: "ticket_type" });
  const teams = useWatch({ control: form.control, name: "other1" });
  const types = useQuery({
    queryKey: ["request-create-types", userId, group],
    queryFn: ({ signal }) => getCreateRequestTypes(group, signal),
    enabled: Boolean(
      lookups.data?.groups.some((row) => String(row.id) === group),
    ),
    retry: false,
  });
  const selectedType = types.data?.find(
    (row) => String(row.id) === type && String(row.handling_group) === group,
  );
  const template = useQuery({
    queryKey: ["request-create-template", userId, selectedType?.id],
    queryFn: async ({ signal }) => {
      const data = await getRequestTemplate(selectedType!.id, signal);
      return {
        ...data,
        forms: data.forms.length ? prepareTemplate(data.forms) : [],
      };
    },
    enabled: Boolean(selectedType),
    retry: false,
  });
  const templateGroups = useMemo(
    () => (selectedType ? (template.data?.forms ?? []) : []),
    [selectedType, template.data],
  );
  const groups = useMemo(
    () => getCreateRequestGroups(templateGroups),
    [templateGroups],
  );
  useEffect(() => {
    form.setValue("ticket_type", "");
    form.setValue("rows", [{ values: {} }]);
    form.clearErrors("rows");
  }, [group, form]);
  useEffect(() => {
    form.setValue("rows", [emptyDetailRow(groups)]);
    form.clearErrors("rows");
  }, [type, groups, form]);
  useEffect(() => {
    if (lookups.data?.customers.length === 1 && !form.getValues("fore_cus"))
      form.setValue("fore_cus", String(lookups.data.customers[0].id));
  }, [lookups.data, form]);
  useEffect(() => {
    const all = lookups.data?.teams.find(
      (row) => normalizeSearchText(row.name ?? "") === "tat ca",
    );
    if (all && teams.length > 1 && teams.includes(String(all.id)))
      form.setValue("other1", [String(all.id)]);
  }, [lookups.data, teams, form]);
  const clone = useCloneRequest({
    userId,
    form,
    lookups: lookups.data,
    types: types.data,
    selectedType,
    groups,
    templateReady: template.isSuccess && !template.isFetching,
  });
  const ready = Boolean(
    !clone.error &&
    !clone.loading &&
    userId &&
    lookups.isSuccess &&
    types.isSuccess &&
    !types.isFetching &&
    selectedType &&
    template.isSuccess &&
    !template.isFetching,
  );
  const mutation = useMutation({
    mutationFn: async (values: CreateRequestValues) => {
      if (!createdRef.current) {
        createdRef.current = await createRequest(values, templateGroups);
        setCreated(createdRef.current);
      }
      while (pendingFiles.current.length) {
        await uploadRequestAttachment(
          createdRef.current.id,
          pendingFiles.current[0],
        );
        pendingFiles.current.shift();
      }
      return createdRef.current;
    },
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Đã tạo yêu cầu.");
      navigate("/requests");
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const submit = (values: CreateRequestValues) => {
    if (submitting.current || createdRef.current || !ready) return;
    const parsed = getCreateRequestSchema(
      groups,
      lookups.data?.groups,
    ).safeParse(values);
    if (!parsed.success) {
      for (const [index, issue] of parsed.error.issues.entries())
        form.setError(
          issue.path.join(".") as Parameters<typeof form.setError>[0],
          { message: issue.message },
          { shouldFocus: index === 0 },
        );
      return;
    }
    if (!validateRelations(values)) return;
    pendingFiles.current = [...files];
    submitting.current = true;
    mutation.mutate(parsed.data);
  };
  function validateRelations(values: CreateRequestValues) {
    const data = lookups.data;
    if (!data) return false;
    const collections = {
      handling_group: data.groups,
      ticket_type: types.data ?? [],
      approve_user: data.approvers,
      fore_cus: data.customers,
      bophansudung: data.departments,
      vanphong: data.offices,
    };
    let valid = true;
    for (const [key, rows] of Object.entries(collections)) {
      const name = key as keyof typeof collections;
      if (!rows.some((row) => String(row.id) === values[name])) {
        form.setError(name, { message: "Vui lòng chọn thông tin hợp lệ." });
        valid = false;
      }
    }
    if (
      values.other1.some(
        (id) => !data.teams.some((row) => String(row.id) === id),
      )
    ) {
      form.setError("other1", { message: "Team không hợp lệ." });
      valid = false;
    }
    return valid;
  }
  const reset = () => {
    if (createdRef.current || mutation.isPending) return;
    form.reset(
      defaults(
        lookups.data?.customers.length === 1
          ? String(lookups.data.customers[0].id)
          : "",
      ),
    );
    setFiles([]);
    mutation.reset();
  };
  const retryAttachments = () => {
    if (submitting.current || !createdRef.current) return;
    submitting.current = true;
    mutation.mutate(form.getValues());
  };
  return {
    form,
    lookups,
    types,
    template,
    groups,
    selectedType,
    ready,
    mutation,
    files,
    setFiles,
    created,
    submit,
    reset,
    retryAttachments,
    clone,
  };
}
