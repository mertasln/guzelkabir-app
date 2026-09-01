"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { IconGps, IconGrip } from "./icons";

type Props = {
  /** Başlangıç konumu (%) */
  initial?: number;
  /** Sağ altta GPS/zaman damgalı stamp içeriği */
  stamp?: ReactNode;
};

/** Önce/sonra sürükleme slider'ı (clip-path tabanlı). */
export function BeforeAfter({ initial = 50, stamp }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(initial);
  const dragging = useRef(false);

  const apply = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let p = ((clientX - r.left) / r.width) * 100;
    p = Math.max(4, Math.min(96, p));
    setPos(p);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    apply(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) apply(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={ref}
      className="ba"
      style={{ ["--pos" as string]: pos + "%" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <div className="ba-layer ba-after" />
      <div className="ba-layer ba-before" />
      <span className="ba-tag l mono">ÖNCE</span>
      <span className="ba-tag r mono">SONRA</span>
      {stamp && (
        <div className="ba-stamp">
          <span className="gps" aria-hidden="true">
            <IconGps width={11} height={11} />
          </span>
          <span>{stamp}</span>
        </div>
      )}
      <div className="ba-handle">
        <span className="grip" aria-hidden="true">
          <IconGrip />
        </span>
      </div>
    </div>
  );
}
