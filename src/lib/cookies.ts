import Cookies from "js-cookie";

export const setCookie = (name: string, value: string, days = 7) => {
  Cookies.set(name, value, { expires: days, path: "/", sameSite: "Lax" });
};

export const getCookie = (name: string): string | undefined => {
  return Cookies.get(name);
};

export const deleteCookie = (name: string) => {
  Cookies.remove(name, { path: "/" });
};
