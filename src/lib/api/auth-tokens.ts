import { z } from "zod";

const tokenSchema = z.string().refine((value) => value.trim().length > 0);

export const authTokensSchema = z.object({
  access: tokenSchema,
  refresh: tokenSchema,
});

export const tokenRefreshResponseSchema = z.object({
  access: tokenSchema,
  refresh: tokenSchema.optional(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;
export type TokenRefreshResponse = z.infer<typeof tokenRefreshResponseSchema>;
export interface TokenRefreshRequest {
  refresh: string;
}
