type PageCardProps = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

export default function PageCard({
  title,
  description,
  href,
  cta,
}: PageCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>

      <a
        href={href}
        className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {cta}
      </a>
    </div>
  );
}