import {
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
} from "@/constants/auth";
import { deleteCookie } from "./cookies";
import { deleteStorageItem } from "./storage";

export function clearAuthSession(): void {
  deleteCookie(COOKIE_TOKEN_KEY);
  deleteCookie(COOKIE_REFRESH_KEY);
  deleteStorageItem(STORAGE_USERNAME_KEY);
  deleteStorageItem(STORAGE_USER_PERMISSION_KEY);
}
