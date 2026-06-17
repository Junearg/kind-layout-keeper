import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = { height: number; children: (w: number, h: number) => ReactNode };

export function AutoSize({ height, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) => setW(e.contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {w > 0 && children(w, height)}
    </div>
  );
}
