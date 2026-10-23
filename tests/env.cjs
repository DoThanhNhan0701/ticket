const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const requestedMode = process.env.TEST_ENV || "development";
const mode =
  { dev: "development", test: "test", prod: "production" }[requestedMode] ||
  requestedMode;
for (const filename of [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env",
]) {
  const path = resolve(__dirname, "..", filename);
  if (existsSync(path)) process.loadEnvFile(path);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value.replace(/\/+$/, "");
}

const baseUrl = process.env.BASE_URL?.trim()
  ? required("BASE_URL")
  : required("TEST_BASE_URL");
const apiBase = (
  process.env.API_URL?.trim() ||
  process.env.API_BASE_URL?.trim() ||
  required("VITE_API_BASE_URL")
).replace(/\/+$/, "");

module.exports = {
  baseUrl,
  apiUrl: apiBase.endsWith("/api") ? apiBase : `${apiBase}/api`,
};
