"use client";

import { useLayoutEffect, useRef, useState } from "react";

const ITEMS = [
  {
    q: "Bakım dini açıdan uygun mu?",
    a: "Varsayılan bakım sade, edebe uygun ve İslami kabir hassasiyetine saygılıdır; aşırı süslemeden kaçınılır. Çiçek ve peyzaj her zaman isteğe bağlıdır.",
  },
  {
    q: "Fotoğraflar gerçekten kabre ait mi?",
    a: "Galeriden yüklenemez; sahada canlı çekilir. GPS, girilen ada/parsel ile eşleşmek zorundadır ve her fotoğrafa değiştirilemez bir zaman damgası işlenir.",
  },
  {
    q: "Ödememi ne zaman yaparım?",
    a: "Önce/sonra fotoğrafları panelinize düştükten ve siz onayladıktan sonra. Memnun kalmazsanız iş ek ücretsiz yenilenir.",
  },
  {
    q: "Ada/parsel bilgisini bilmiyorum?",
    a: "Mezarlık adı ve merhum bilgisiyle başvurmanız yeterli; ekibimiz yeri harita ve saha tespitiyle bulur.",
  },
  {
    q: "Yurt dışından ödeme yapabilir miyim?",
    a: "Evet — Euro ve kartla ödeyebilirsiniz. Abonelik otomatik yenilenir ve tek tıkla iptal edilir.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq">
      {ITEMS.map((item, i) => (
        <FaqItem key={i} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
      ))}
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    setHeight(open ? (inner.current?.offsetHeight ?? 0) : 0);
  }, [open]);

  return (
    <div className={`faq-item ${open ? "open" : ""}`}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span className="qmark">۰</span> {q}
        <span className="pm" aria-hidden="true" />
      </button>
      <div className="faq-a" style={{ height }}>
        <div className="faq-a-inner" ref={inner}>
          {a}
        </div>
      </div>
    </div>
  );
}
