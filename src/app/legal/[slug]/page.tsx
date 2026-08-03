import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { legalDocumentBySlug, legalDocuments } from "@/lib/legal/documents";

export function generateStaticParams() {
  return legalDocuments.map((document) => ({ slug: document.slug }));
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const document = legalDocumentBySlug((await params).slug);
  if (!document) notFound();
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <Link href="/events" className="text-sm font-semibold text-brand underline">
        Back to events
      </Link>
      <Card className="mt-6 rounded-3xl p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Eoke LLC</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{document.title}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Version {document.version} · Effective {document.effectiveDate} · Owner approved
        </p>
        <div className="mt-8 space-y-7 text-base leading-7 text-slate-700">
          {document.sections.map((section) => (
            <section key={`${document.slug}-${section.heading ?? "intro"}`}>
              {section.heading ? (
                <h2 className="text-xl font-semibold text-ink">{section.heading}</h2>
              ) : null}
              <p className={section.heading ? "mt-2" : ""}>{section.text}</p>
            </section>
          ))}
        </div>
      </Card>
    </main>
  );
}
