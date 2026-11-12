import { useEffect } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export function HomepageRedirect() {
  useEffect(() => {
    window.location.replace(import.meta.env.VITE_HOMEPAGE_URL);
  }, []);

  return <LoadingScreen />;
}
