export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
