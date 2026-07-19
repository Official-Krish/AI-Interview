import { useState, useMemo, type FormEvent } from "react";
import { StaticPageLayout } from "@/components/layout/StaticPageLayout";
import { StaticPageHero } from "@/components/static/StaticPageHero";
import { RevealSection } from "@/components/motion/RevealSection";
import { client } from "@/lib/eden";
import { SEO } from "@/components/SEO";
import toast from "react-hot-toast";

const SUBJECTS = [
  { value: "General inquiry", label: "General inquiry" },
  { value: "Bug report", label: "Bug report" },
  { value: "Feature request", label: "Feature request" },
  { value: "Pro upgrade", label: "Pro upgrade inquiry" },
  { value: "Account help", label: "Account help" },
  { value: "Other", label: "Other" },
] as const;

export function ContactPage() {
  const presetSubject = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("subject");
  }, []);

  const isProUpgrade = presetSubject === "Pro upgrade";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(presetSubject ?? "General inquiry");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);

    const loadingToast = toast.loading(
      isProUpgrade ? "Sending pro upgrade request..." : "Sending message...",
    );

    const query = new URLSearchParams(window.location.search);
    const preset = query.get("subject");
    const finalSubject = preset ?? subject;

    const { data, error } = await client.api.contact.send.post({
      name,
      email,
      subject: finalSubject,
      message,
    });

    setSending(false);
    toast.dismiss(loadingToast);

    if (error) {
      const errVal =
        typeof error.value === "string"
          ? error.value
          : ((error.value as { error?: string })?.error ?? "Failed to send");
      toast.error(errVal);
      return;
    }

    toast.success((data as { message?: string })?.message ?? "Message sent!");
    setName("");
    setEmail("");
    setMessage("");
  }

  return (
    <StaticPageLayout>
      <SEO title="Contact" description="Get in touch with the Evalio team." />
      <StaticPageHero
        badge={isProUpgrade ? "Pro Upgrade" : "Contact"}
        title={isProUpgrade ? "Go Pro." : "Let's talk."}
        subtitle={
          isProUpgrade
            ? "Pro tier is rolling out — tell us what you need and we'll open up a slot for you."
            : "Questions, feedback, or need help? Drop us a message and we'll get back to you."
        }
      />

      <RevealSection>
        <section className="landing-container pb-28">
          <div className="max-w-3xl mx-auto grid md:grid-cols-5 gap-10">
            <form onSubmit={handleSubmit} className="md:col-span-3 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="static-label">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="static-input"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="static-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="static-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="static-label">
                  Subject
                </label>
                <select
                  id="subject"
                  className={`static-input ${isProUpgrade ? "text-[var(--landing-accent)] font-medium" : ""}`}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isProUpgrade}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {isProUpgrade && (
                  <p className="text-[11px] text-[var(--landing-fg-faint)] mt-1">
                    Pro upgrade subject is pre-selected from the nav link.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="message" className="static-label">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  className="static-input resize-none"
                  placeholder="What's on your mind?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="landing-cta-primary landing-cta-sharp text-[13px] disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send message"}
              </button>
            </form>

            <div className="md:col-span-2 space-y-4">
              <div className="static-card">
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--landing-fg-faint)] mb-1">
                  GitHub
                </p>
                <a
                  href="https://github.com/Official-Krish"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[14px] text-[var(--landing-accent)] hover:underline"
                >
                  @Official-Krish
                </a>
              </div>
              <div className="static-card">
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--landing-fg-faint)] mb-1">
                  Built by
                </p>
                <p className="text-[14px] text-[var(--landing-fg-muted)]">
                  Krish Anand
                </p>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>
    </StaticPageLayout>
  );
}
