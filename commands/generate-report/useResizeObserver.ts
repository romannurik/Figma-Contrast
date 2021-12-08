import { useLayoutEffect, useMemo } from "react";

export function useResizeObserver(callback: () => any, node: HTMLElement) {
  const resizeObserver = useMemo(() => new ResizeObserver(entries => {
    if (!node) {
      return;
    }

    callback();
  }), [node]);

  useLayoutEffect(() => {
    if (!node || !resizeObserver) {
      return;
    }

    resizeObserver.observe(node);
    return () => resizeObserver.unobserve(node);
  }, [node, resizeObserver]);
}