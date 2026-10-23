import { waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { toast } from "sonner";

export async function expectErrorToast(message: string | RegExp) {
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      typeof message === "string"
        ? expect.stringContaining(message)
        : expect.stringMatching(message),
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
}
