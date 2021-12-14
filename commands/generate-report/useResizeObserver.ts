import { useLayoutEffect, useMemo, useRef } from "react";

export function useResizeObserver(callback: () => any, node: HTMLElement) {
  const cb = useRef<Function>(); // kinda hacky
  cb.current = callback;

  const resizeObserver = useMemo(() => new ResizeObserver(entries => {
    if (!node) {
      return;
    }

    cb.current();
  }), [node]);

  useLayoutEffect(() => {
    if (!node || !resizeObserver) {
      return;
    }

    resizeObserver.observe(node);
    return () => resizeObserver.unobserve(node);
  }, [node, resizeObserver]);
}