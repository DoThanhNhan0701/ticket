import { toast } from "sonner";
import { translateMessage } from "./index";

// Keep backend values intact; localize known messages only as they are displayed.
export const localizedToast = {
  success: (...[message, ...options]: Parameters<typeof toast.success>) =>
    toast.success(
      typeof message === "string" ? translateMessage(message) : message,
      ...options,
    ),
  error: (...[message, ...options]: Parameters<typeof toast.error>) =>
    toast.error(
      typeof message === "string" ? translateMessage(message) : message,
      ...options,
    ),
};
