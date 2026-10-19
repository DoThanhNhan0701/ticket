import {
  generatePath,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";

export function LegacyPageRedirect({ to }: Readonly<{ to: string }>) {
  const params = useParams();
  const { search, hash } = useLocation();
  const pathParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) pathParams[key] = value;
  }

  return (
    <Navigate
      to={{ pathname: generatePath(to, pathParams), search, hash }}
      replace
    />
  );
}
