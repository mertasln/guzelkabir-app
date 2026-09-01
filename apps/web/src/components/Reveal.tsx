"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type Props = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
  id?: string;
};

/** IntersectionObserver ile görünür olunca .in alır. */
export function Reveal({ as: Tag = "div", className = "", children, style, id }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} id={id} style={style} className={`reveal ${shown ? "in" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
