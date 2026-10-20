import { z } from "zod";
import { getRequest, postRequest, putRequest } from "@/lib/api/client";
import { parseApiResponse } from "@/lib/api/response-schema";
import { ticketUserPermissionSchema } from "@/features/auth/schemas/account-schema";
import { settingsConfig } from "../utils/settings-config";
import {
  settingsListSchemas,
  settingsDetailSchemas,
  positionPermissionSchema,
} from "../schemas/settings-schema";
import type {
  SettingsKind,
  SettingsRecord,
  SettingsPageData,
  SettingsParams,
  LookupKind,
  SettingsLookups,
  SettingsFormValues,
} from "../types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}
export async function listSettingsRequest(
  kind: SettingsKind,
  params: SettingsParams,
  signal?: AbortSignal,
): Promise<SettingsPageData> {
  const config = settingsConfig[kind];
  const response = await getRequest<unknown>(config.listEndpoint, {
    params: {
      page: String(params.page),
      page_size: String(params.pageSize),
      columnSort: "id",
      typeSort: "descend",
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { is_active: params.status } : {}),
    },
    signal,
  });
  const parsed = parseApiResponse(
    settingsListSchemas[kind],
    response,
    `Dữ liệu ${config.label} không hợp lệ.`,
  );
  if (!Array.isArray(parsed)) return parsed;
  const keyword = normalizeSearch(params.search);
  const rows = parsed.filter((row) => {
    const values = [
      row.name,
      "username" in row ? row.username : "",
      "email" in row ? row.email : "",
      "msnv" in row ? row.msnv : "",
      "description" in row ? row.description : "",
    ];
    return (
      (!params.status || String(row.is_active) === params.status) &&
      normalizeSearch(values.filter(Boolean).join(" ")).includes(keyword)
    );
  });
  return {
    count: rows.length,
    results: rows.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    ),
  };
}
async function allRecords(kind: SettingsKind, signal?: AbortSignal) {
  const params = { page: 1, pageSize: 1000, search: "", status: "" };
  const first = await listSettingsRequest(kind, params, signal);
  const results = [...first.results];
  while (results.length < first.count) {
    params.page += 1;
    const page = await listSettingsRequest(kind, params, signal);
    if (!page.results.length)
      throw new Error("Danh mục chưa được tải đầy đủ. Vui lòng thử lại.");
    results.push(...page.results);
  }
  return results;
}
async function lookup(
  kind: LookupKind,
  signal?: AbortSignal,
): Promise<SettingsRecord[]> {
  if (kind === "position-permissions")
    return parseApiResponse(
      z.array(positionPermissionSchema),
      await getRequest<unknown>("/list_position_permission/", { signal }),
      "Dữ liệu quyền hạn không hợp lệ.",
    );
  if (kind === "permission-groups") {
    const data = parseApiResponse(
      ticketUserPermissionSchema,
      await getRequest<unknown>("/list_permission/", { signal }),
      "Dữ liệu nhóm quyền không hợp lệ.",
    );
    return data.ls_permission.map((group) => ({ ...group, is_active: true }));
  }
  return allRecords(kind, signal);
}
export async function settingsLookupsRequest(
  kinds: readonly LookupKind[],
  signal?: AbortSignal,
): Promise<SettingsLookups> {
  const entries = await Promise.all(
    [...new Set(kinds)].map(
      async (kind) => [kind, await lookup(kind, signal)] as const,
    ),
  );
  return Object.fromEntries(entries);
}
export async function settingsDetailRequest(
  kind: SettingsKind,
  id: number,
  signal?: AbortSignal,
): Promise<SettingsRecord> {
  const config = settingsConfig[kind];
  const path = `${config.writeEndpoint}${id}`;
  return parseApiResponse(
    settingsDetailSchemas[kind],
    await getRequest<unknown>(path, { signal }),
    `Không tải được thông tin ${config.label}.`,
  );
}
function settingsBody(
  kind: SettingsKind,
  values: SettingsFormValues,
  record?: SettingsRecord,
  attachment?: File,
) {
  if (kind === "handling-departments")
    return {
      name: values.name,
      description: values.description,
      is_active: values.is_active,
      is_manager: Number(values.is_manager),
      group_email: values.group_email,
      ls_member: values.ls_member.map(Number),
    };
  if (kind === "positions")
    return {
      name: values.name,
      description: values.description,
      is_active: values.is_active,
      permission: values.permission.map(Number),
    };
  if (kind === "teams")
    return {
      name: values.name,
      bophan: Number(values.bophan),
      is_active: values.is_active,
    };
  if (kind === "offices")
    return { name: values.name, is_active: values.is_active };
  const body = new FormData();
  body.append("is_active", String(values.is_active));
  if (kind !== "users") body.append("name", values.name);
  if (kind === "request-types") {
    body.append("handling_group", values.handling_group);
    if (attachment) body.append("attachment_file", attachment);
  }
  if (kind === "users") {
    for (const key of [
      "username",
      "first_name",
      "last_name",
      "email",
      "team",
      "chucvu",
      "nhomquyen",
      "bophan",
    ] as const)
      body.append(key, values[key]);
    if (!record) body.append("msnv", values.msnv);
    if (record)
      body.append("is_superuser", String(record.is_superuser ?? false));
  }
  return body;
}
export async function saveSettingsRequest(
  kind: SettingsKind,
  values: SettingsFormValues,
  record?: SettingsRecord,
  attachment?: File,
) {
  const config = settingsConfig[kind];
  const body = settingsBody(kind, values, record, attachment);
  const path = record
    ? `${config.writeEndpoint}${record.id}`
    : config.writeEndpoint;
  const response = await (record
    ? putRequest<unknown>(path, { body })
    : postRequest<unknown>(path, { body }));
  if (
    typeof response === "object" &&
    response !== null &&
    ("error" in response || "message" in response)
  ) {
    const parsed = z
      .object({ error: z.unknown().optional(), message: z.string().optional() })
      .parse(response);
    throw new Error(
      parsed.message ?? "Không lưu được dữ liệu. Vui lòng kiểm tra thông tin.",
    );
  }
  return parseApiResponse(
    settingsDetailSchemas[kind],
    response,
    "Phản hồi lưu dữ liệu không hợp lệ. Vui lòng tải lại danh sách để kiểm tra.",
  );
}
