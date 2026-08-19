"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type CourtDocument = {
  label: string;
  src: string;
  alt: string;
  imageClassName?: string;
};

export function CourtCarousel({ documents }: { documents: CourtDocument[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % documents.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [documents.length]);

  return (
    <div className="court-carousel mt-8">
      <button
        type="button"
        aria-label="Previous court document"
        className="court-carousel-arrow left-2 sm:left-6"
        onClick={() => setActive((current) => (current - 1 + documents.length) % documents.length)}
      >
        ‹
      </button>
      <div className="court-carousel-stage">
        {documents.map((document, index) => {
          const offset = (index - active + documents.length) % documents.length;
          const position = offset === 0 ? "active" : offset === 1 ? "right" : offset === documents.length - 1 ? "left" : "rear";

          return (
            <article key={document.label} className={`court-carousel-card court-carousel-card-${position}`} aria-hidden={position !== "active"}>
              <Image
                src={document.src}
                alt={document.alt}
                width={1300}
                height={1800}
                loading="eager"
                sizes="(min-width: 1024px) 680px, 88vw"
                className={`h-full w-full ${document.imageClassName ?? "object-cover object-top"}`}
              />
            </article>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Next court document"
        className="court-carousel-arrow right-2 sm:right-6"
        onClick={() => setActive((current) => (current + 1) % documents.length)}
      >
        ›
      </button>
    </div>
  );
}
