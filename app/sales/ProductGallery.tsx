"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type GalleryItem = {
  documentType: string;
  clientName: string;
  court: string;
  referenceLabel: "Legal Aid" | "FAM";
  reference: string;
  matter: string;
  status: string;
  description: string;
  image: string;
  alt: string;
};

type ProductGalleryProps = {
  items: GalleryItem[];
};

export default function ProductGallery({ items }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex];

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!activeItem) return null;

  function previous() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  function next() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-form" aria-label="Completed NewGen output examples">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Completed demo outputs</p>
          <h2 className="mt-1 text-xl font-bold tracking-normal text-slate-950">{activeItem.documentType}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={previous} aria-label="Previous output" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-xl font-bold text-slate-700 hover:bg-slate-50">
            &lt;
          </button>
          <button type="button" onClick={next} aria-label="Next output" className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-xl font-bold text-slate-700 hover:bg-slate-50">
            &gt;
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={item.documentType}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {item.documentType}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden bg-slate-100 px-4 py-6">
        <div
          className="flex items-center gap-4 transition-transform duration-700 ease-out"
          style={{ transform: `translateX(calc(50% - ${activeIndex * 76 + 38}%))` }}
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <article
                key={item.documentType}
                className={`shrink-0 basis-[76%] overflow-hidden rounded-lg border bg-white shadow-form transition-all duration-700 ${
                  isActive ? "scale-100 border-blue-200 opacity-100" : "scale-[0.88] border-slate-200 opacity-65"
                }`}
                aria-hidden={!isActive}
              >
                <div className="grid min-h-[405px] md:grid-cols-[0.95fr_1.05fr]">
                  <div className="border-b border-slate-200 bg-white p-4 md:border-b-0 md:border-r">
                    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        width={900}
                        height={1160}
                        sizes="(min-width: 1024px) 340px, 70vw"
                        className="aspect-[0.78] h-auto w-full object-cover object-top"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{item.documentType}</p>
                        <h3 className="mt-2 text-2xl font-bold leading-tight tracking-normal text-slate-950">{item.clientName}</h3>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{item.status}</span>
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm">
                      <PreviewRow label="Court" value={item.court} />
                      <PreviewRow label={item.referenceLabel} value={item.reference} />
                      <PreviewRow label="Matter" value={item.matter} />
                    </dl>

                    <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{item.description}</p>

                    <div className="mt-auto pt-5">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Completed output</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                          Demo matter data has been merged into a lawyer-reviewable document with populated party, court, reference and matter fields.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
