import { z } from "zod";

export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    count: z.number().int().nonnegative(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });
}

export function parseApiResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  message: string,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(message);
  return result.data;
}
