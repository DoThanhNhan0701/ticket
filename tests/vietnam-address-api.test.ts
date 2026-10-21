import { afterEach, expect, it, vi } from "vitest";
import {
  listVietnamProvinces,
  listVietnamWards,
} from "@/features/recruitment/api/vietnam-address-api";
afterEach(() => vi.unstubAllGlobals());
const respond = (data: unknown, status = 200) => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(data), { status }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};
it("loads public provinces without app credentials and preserves two-digit codes", async () => {
  const fetcher = respond([{ code: 1, name: "Thành phố Hà Nội" }]);
  expect(await listVietnamProvinces()).toEqual([
    { value: "01", label: "Thành phố Hà Nội" },
  ]);
  expect(fetcher).toHaveBeenCalledWith(
    "https://provinces.open-api.vn/api/v2/p/",
    expect.objectContaining({
      credentials: "omit",
      headers: { Accept: "application/json" },
    }),
  );
});
it("requests wards for the chosen province and preserves five-digit codes", async () => {
  const fetcher = respond([
    { code: 4, name: "Phường Ba Đình", province_code: 1 },
  ]);
  expect(await listVietnamWards("01")).toEqual([
    { value: "00004", label: "Phường Ba Đình" },
  ]);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://provinces.open-api.vn/api/v2/w/?province=1",
  );
});
it("rejects subdivisions belonging to a different province", async () => {
  respond([{ code: 4, name: "Phường Ba Đình", province_code: 1 }]);
  await expect(listVietnamWards("79")).rejects.toThrow("không thuộc tỉnh");
});
it("rejects malformed province codes without making a request", async () => {
  const fetcher = respond([]);
  await expect(listVietnamWards("01&province=79")).rejects.toThrow("Mã tỉnh");
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([500, 429])(
  "surfaces HTTP %i without accepting an empty success list",
  async (status) => {
    respond({}, status);
    await expect(listVietnamProvinces()).rejects.toThrow("Không tải được");
  },
);
it("rejects malformed data and forwards cancellation", async () => {
  const fetcher = respond([{ code: "01", name: "Hà Nội" }]);
  const signal = new AbortController().signal;
  await expect(listVietnamProvinces(signal)).rejects.toThrow("không hợp lệ");
  expect(fetcher.mock.calls[0][1].signal).toBe(signal);
});
