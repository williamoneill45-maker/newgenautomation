import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CourtCarousel } from "./CourtCarousel";

const enquiryHref = "mailto:will@newgenbusiness.nz?subject=NewGen%20demo%20query";

export const metadata: Metadata = {
  title: "NewGen | Family Law Documents, Legal Aid and Billing",
  description:
    "Enter the matter once. NewGen generates the court documents, Legal Aid billing and Legal Aid applications your team already prepares manually.",
};

const intakeScreenshots = [
  {
    src: "/sales/uploaded-demo/01-matter-overview.png",
    alt: "NewGen matter overview with client, Legal Aid and proceeding details entered",
    className: "h-[460px] object-cover object-[center_10%]",
  },
  {
    src: "/sales/uploaded-demo/02-children-details.png",
    alt: "NewGen child details screen with completed child information",
    className: "aspect-[2.08] object-contain object-top bg-white",
  },
];

const courtDocuments = [
  {
    label: "Information Sheet",
    src: "/sales/uploaded-demo/03-information-sheet.png",
    alt: "Generated Family Court information sheet completed from the matter intake",
    imageClassName: "object-contain object-center bg-white",
  },
  {
    label: "Parenting Order",
    src: "/sales/uploaded-demo/04-parenting-order-cover.png",
    alt: "Generated parenting order application completed from the matter intake",
    imageClassName: "object-contain object-center bg-white",
  },
  {
    label: "Protection Order",
    src: "/sales/uploaded-demo/05-parenting-order-detail.png",
    alt: "Generated protection order document completed from the matter intake",
    imageClassName: "object-contain object-center bg-white",
  },
];

const ownershipItems = [
  "Client-owned GitHub",
  "Client-owned Vercel",
  "Client-owned Supabase",
  "Client-owned document storage",
  "Support by approved pull request",
];

export default function SalesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/sales" className="flex items-center gap-3 text-2xl font-bold tracking-normal text-slate-950">
            <img
              src="/sales/newgen-logo-mark.png"
              alt="NewGen logo"
              width={56}
              height={56}
              className="h-12 w-12 rounded-lg object-cover"
            />
            NewGen
          </Link>
          <a href={enquiryHref} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            Send a demo query
          </a>
        </nav>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 sm:px-8 lg:grid-cols-[0.45fr_0.55fr] lg:items-center lg:py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">NewGen for family law</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-normal text-slate-950 sm:text-6xl">
              Buy back your time.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              AI powered automation, for NZ lawyers.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={enquiryHref} className="rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/15 hover:bg-blue-500">
                Send a demo query
              </a>
              <a href="#workflow" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">
                See the workflow
              </a>
            </div>
          </div>
          <ScreenshotFrame
            src="/sales/uploaded-demo/01-matter-overview.png"
            alt="NewGen matter intake overview"
            priority
            className="h-[520px] object-cover object-top"
          />
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-slate-50 py-9 lg:py-12">
        <div className="mx-auto max-w-[92rem] px-5 sm:px-8">
          <SectionHeader
            eyebrow="NewGen process"
            title="Enter client details once."
            copy="The client, respondent, children, court and Legal Aid details are captured once and reused throughout the matter."
          />
          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            {intakeScreenshots.map((shot) => (
              <ScreenshotFrame key={shot.src} src={shot.src} alt={shot.alt} className={shot.className} sizes="(min-width: 1024px) 45rem, 95vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-9 lg:py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Court documents"
            title="Court documents produced from one intake."
            copy="The same information flows directly into the court documents prepared for lawyer review."
          />
          <CourtCarousel documents={courtDocuments} />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-9 lg:py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Domestic violence affidavits"
            title="Affidavits streamlined."
            copy="Utilise Wispr Flow to capture spoken instructions, organise the evidence and produce a draft affidavit for lawyer review."
          />
          <div className="mt-7 grid gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Dictate instructions", "Speak the facts using Wispr Flow."],
                ["Structure the evidence", "ChatGPT helps organise the notes into clear affidavit paragraphs."],
                ["Review the affidavit", "NewGen produces a draft affidavit for the lawyer to review, edit and finalise."],
              ].map(([title, copy], index) => (
                <article key={title} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/15">{index + 1}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <ScreenshotFrame
              src="/sales/uploaded-demo/10-domestic-affidavit-pages.png"
              alt="Draft domestic violence affidavit pages prepared for lawyer review"
              className="aspect-[1.44] object-contain object-center bg-white"
              sizes="(min-width: 1024px) 1280px, 95vw"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-9 lg:py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Legal Aid billing"
            title="Billing at the touch of a button."
            copy="Select the completed work and NewGen prepares the legal aid form for lawyer review."
          />
          <div className="mt-7 grid gap-6 lg:grid-cols-2 lg:items-start">
            <ScreenshotPanel
              src="/sales/uploaded-demo/07-billing-workbench.png"
              alt="NewGen billing workbench with multiple completed Form 32B rows selected"
              imageClassName="aspect-[0.76] object-contain object-top bg-white"
            />
            <ScreenshotPanel
              src="/sales/uploaded-demo/08-form-32b.png"
              alt="Generated Form 32B Legal Aid billing document with completed client and billing rows"
              imageClassName="aspect-[0.72] object-contain object-top bg-white"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-9 lg:py-12">
        <div className="mx-auto grid max-w-7xl gap-7 px-5 sm:px-8 lg:grid-cols-[0.22fr_0.78fr] lg:items-start">
          <SectionIntro
            eyebrow="Claims register"
            title="Track the claim."
            copy="Generated billing stays visible by matter, amount, status and payment position."
          />
          <ScreenshotFrame
            src="/sales/screenshots/uploaded-billing-register.png"
            alt="NewGen billing register showing generated Legal Aid claims"
            className="h-[620px] object-cover object-top"
            sizes="(min-width: 1024px) 980px, 95vw"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-9 lg:py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeader
            eyebrow="Legal Aid application"
            title="Applications done in minutes."
            copy="The application is generated from information already captured during intake. Supporting material can be attached before lawyer review."
          />
          <div className="mt-7">
            <ScreenshotPanel
              src="/sales/uploaded-demo/09-legal-aid-application.png"
              alt="Generated Legal Aid application completed with applicant, address, child and proceeding details"
              imageClassName="h-[1120px] object-cover object-top bg-white"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0B1736] py-12 text-white lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">Client-owned deployment</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal">
              Your firm’s data stays under your control.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-200">
              Production deployments are designed so the firm owns the accounts, controls access and keeps generated records in firm-controlled systems.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-200">
              NewGen supports the software without requiring routine access to production client records after handover.
            </p>
          </div>
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ownershipItems.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-400/15 text-sm font-black text-blue-100">✓</div>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-100">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-300">
              NewGen is not a trust accounting system and should not be represented as NZLS-approved, NZLS-endorsed, Privacy Act certified, SOC 2 certified or ISO 27001 certified.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">{title}</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{copy}</p>
    </div>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">{title}</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{copy}</p>
    </div>
  );
}

function ScreenshotFrame({
  src,
  alt,
  className = "h-auto w-full",
  priority = false,
  sizes = "(min-width: 1024px) 760px, 95vw",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-form">
      <Image
        src={src}
        alt={alt}
        width={1800}
        height={1200}
        priority={priority}
        loading={priority ? undefined : "eager"}
        sizes={sizes}
        className={`w-full ${className}`}
      />
    </div>
  );
}

function ScreenshotPanel({ src, alt, imageClassName = "aspect-[1.08] object-cover object-top" }: { src: string; alt: string; imageClassName?: string }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-form">
      <ScreenshotFrame src={src} alt={alt} className={imageClassName} />
    </article>
  );
}
