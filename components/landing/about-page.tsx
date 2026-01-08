import {
  IconHeart,
  IconRocket,
  IconSparkles,
  IconTarget,
} from "@tabler/icons-react";
import { LandingFooter } from "./landing-footer";
import { LandingNav } from "./landing-nav";

const values = [
  {
    icon: IconSparkles,
    title: "Quality First",
    description:
      "Every image we process meets professional standards. We never compromise on the output quality.",
  },
  {
    icon: IconRocket,
    title: "Speed Matters",
    description:
      "Real estate moves fast. Our AI delivers results in seconds, not hours or days.",
  },
  {
    icon: IconHeart,
    title: "Built for You",
    description:
      "Designed specifically for real estate professionals. Every feature solves a real problem.",
  },
  {
    icon: IconTarget,
    title: "Simple Pricing",
    description:
      "No subscriptions, no hidden fees. Pay only for what you use, when you use it.",
  },
];

export function AboutPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      <LandingNav />

      <main>
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-16 text-center md:pt-28 md:pb-24">
          <div className="mx-auto max-w-3xl">
            <p
              className="font-semibold text-sm uppercase tracking-wider"
              style={{ color: "var(--landing-accent)" }}
            >
              About Us
            </p>
            <h1
              className="mt-3 font-bold text-4xl tracking-tight sm:text-5xl md:text-6xl"
              style={{ color: "var(--landing-text)" }}
            >
              Making property photos
              <br />
              look incredible
            </h1>
            <p
              className="mt-6 text-lg leading-relaxed md:text-xl"
              style={{ color: "var(--landing-text-muted)" }}
            >
              AI Studio is an AI-powered photo enhancement platform built
              specifically for real estate professionals. We help agents,
              photographers, and property managers create stunning visuals that
              sell properties faster.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="px-6 pb-24">
          <div
            className="mx-auto max-w-4xl rounded-3xl p-8 md:p-12"
            style={{
              backgroundColor: "var(--landing-card)",
              boxShadow: "0 20px 40px -12px var(--landing-shadow)",
              border: "1px solid var(--landing-border)",
            }}
          >
            <h2
              className="font-bold text-2xl tracking-tight sm:text-3xl"
              style={{ color: "var(--landing-text)" }}
            >
              Our Story
            </h2>
            <div
              className="mt-6 space-y-4 text-base leading-relaxed"
              style={{ color: "var(--landing-text-muted)" }}
            >
              <p>
                We started AI Studio because we saw a gap in the market. Real
                estate professionals needed high-quality photo enhancement, but
                existing solutions were either too expensive, too slow, or
                required technical expertise.
              </p>
              <p>
                Professional photography services can cost hundreds of dollars
                per property and take days to deliver. DIY editing tools require
                hours of learning and manual work. Neither option works when you
                have multiple listings and tight deadlines.
              </p>
              <p>
                AI Studio bridges this gap. Our AI understands real estate
                photography. It knows how to brighten rooms, enhance curb
                appeal, and make properties look their absolute best. All
                automatically, in seconds.
              </p>
              <p>
                Today, we&apos;ve processed over 50,000 images for real estate
                professionals across Norway. Our users report up to 85% higher
                engagement on their listings. And we&apos;re just getting
                started.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section
          className="px-6 py-24"
          style={{ backgroundColor: "var(--landing-bg-alt)" }}
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p
                className="font-semibold text-sm uppercase tracking-wider"
                style={{ color: "var(--landing-accent)" }}
              >
                Our Values
              </p>
              <h2
                className="mt-3 font-bold text-3xl tracking-tight sm:text-4xl"
                style={{ color: "var(--landing-text)" }}
              >
                What we believe in
              </h2>
            </div>

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {values.map((value) => (
                <div
                  className="rounded-2xl p-6"
                  key={value.title}
                  style={{
                    backgroundColor: "var(--landing-card)",
                    border: "1px solid var(--landing-border)",
                  }}
                >
                  <div
                    className="mb-4 inline-flex size-12 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "var(--landing-bg)",
                      border: "1px solid var(--landing-border)",
                    }}
                  >
                    <value.icon
                      className="size-6"
                      style={{ color: "var(--landing-accent)" }}
                    />
                  </div>
                  <h3
                    className="font-semibold text-lg"
                    style={{ color: "var(--landing-text)" }}
                  >
                    {value.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: "var(--landing-text-muted)" }}
                  >
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="font-semibold text-sm uppercase tracking-wider"
              style={{ color: "var(--landing-accent)" }}
            >
              Our Mission
            </p>
            <h2
              className="mt-3 font-bold text-3xl tracking-tight sm:text-4xl"
              style={{ color: "var(--landing-text)" }}
            >
              Empowering real estate professionals
            </h2>
            <p
              className="mt-6 text-lg leading-relaxed"
              style={{ color: "var(--landing-text-muted)" }}
            >
              Our mission is to democratize professional-quality real estate
              photography. We believe every property deserves to be presented at
              its best, regardless of budget or technical expertise. By
              harnessing the power of AI, we make this possible for everyone.
            </p>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="px-6 pb-24">
          <div
            className="mx-auto max-w-4xl rounded-3xl px-8 py-16 text-center md:px-16"
            style={{
              backgroundColor: "var(--landing-card)",
              boxShadow: "0 25px 50px -12px var(--landing-shadow)",
              border: "1px solid var(--landing-border)",
            }}
          >
            <h2
              className="font-bold text-3xl tracking-tight sm:text-4xl"
              style={{ color: "var(--landing-text)" }}
            >
              Want to learn more?
            </h2>
            <p
              className="mx-auto mt-4 max-w-lg text-lg leading-relaxed"
              style={{ color: "var(--landing-text-muted)" }}
            >
              We&apos;d love to hear from you. Whether you have questions about
              our service or just want to say hello, get in touch.
            </p>
            <div className="mt-8">
              <a
                className="inline-flex h-12 items-center rounded-full px-8 font-medium text-base transition-all duration-200 hover:scale-[1.03]"
                href="/contact"
                style={{
                  backgroundColor: "var(--landing-accent)",
                  color: "var(--landing-accent-foreground)",
                }}
              >
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
