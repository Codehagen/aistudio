import { LandingFooter } from "./landing-footer";
import { LandingNav } from "./landing-nav";

interface LegalPageProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({
  title,
  subtitle,
  lastUpdated,
  children,
}: LegalPageProps) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      <LandingNav />

      <main>
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-12 text-center md:pt-28">
          <div className="mx-auto max-w-3xl">
            <h1
              className="font-bold text-4xl tracking-tight sm:text-5xl"
              style={{ color: "var(--landing-text)" }}
            >
              {title}
            </h1>
            <p
              className="mt-4 text-lg"
              style={{ color: "var(--landing-text-muted)" }}
            >
              {subtitle}
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Last updated: {lastUpdated}
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="px-6 pb-24">
          <div
            className="mx-auto max-w-3xl rounded-2xl p-8 md:p-12"
            style={{
              backgroundColor: "var(--landing-card)",
              boxShadow: "0 20px 40px -12px var(--landing-shadow)",
              border: "1px solid var(--landing-border)",
            }}
          >
            <div
              className="prose prose-lg max-w-none"
              style={
                {
                  "--tw-prose-body": "var(--landing-text-muted)",
                  "--tw-prose-headings": "var(--landing-text)",
                  "--tw-prose-links": "var(--landing-accent)",
                  "--tw-prose-bold": "var(--landing-text)",
                } as React.CSSProperties
              }
            >
              {children}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 first:mt-0">
      <h2
        className="font-semibold text-xl"
        style={{ color: "var(--landing-text)" }}
      >
        {title}
      </h2>
      <div
        className="mt-4 space-y-4 text-sm leading-relaxed"
        style={{ color: "var(--landing-text-muted)" }}
      >
        {children}
      </div>
    </div>
  );
}
