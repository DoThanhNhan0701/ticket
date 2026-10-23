import { act } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";

// Exercise recovery from a query refresh independently of removed retry controls.
export async function refreshFailedQueries(client: QueryClient) {
  await act(async () => {
    await client.refetchQueries({
      predicate: (query) => query.state.status === "error",
    });
  });
}
