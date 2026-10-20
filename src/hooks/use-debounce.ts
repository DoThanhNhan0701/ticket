import { useEffect, useRef, useState } from "react";

export function useDebounce<T>(value: T, delay: number = 300, resetKey = 0): T {
  const initialValue = useRef(value);
  const [result, setResult] = useState({ value, resetKey });

  useEffect(() => {
    const handler = setTimeout(() => {
      setResult({ value, resetKey });
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, resetKey]);

  return result.resetKey === resetKey ? result.value : initialValue.current;
}
