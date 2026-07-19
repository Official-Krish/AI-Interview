import { Resend } from "resend";
import { prisma } from "./prisma";
import { logger } from "./logger";

const resend = new Resend(Bun.env.RESEND_API_KEY!);
const EMAIL_FROM = Bun.env.EMAIL_FROM ?? "Evalio <noreply@krishlabs.tech>";
const FRONTEND_URL = "https://evalio.krishlabs.tech";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 60_000;

const C = {
  bg: "#080808", // canvas
  card: "#0e0e10", // slightly elevated surface
  panel: "#101013", // inset panel (codes, quotes)
  border: "#1d1d22", // hairline border
  borderSoft: "#16161a", // even softer divider
  accent: "#b8a88a", // warm gold (the product accent)
  accentBright: "#cfc0a6", // lighter gold for text-on-dark emphasis
  accentGlow: "rgba(184,168,138,0.14)",
  text: "#eceae6", // primary text
  textMuted: "#8a8884", // secondary
  textFaint: "#5c5a56", // tertiary / legal
};

const YEAR = new Date().getFullYear();

const LOGO_SVG = `<svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="13.5" stroke="${C.accent}" stroke-width="0.6" opacity="0.28"/>
  <ellipse cx="16" cy="16" rx="13.5" ry="4.8" stroke="${C.accent}" stroke-width="0.6" opacity="0.42" transform="rotate(-24 16 16)"/>
  <circle cx="16" cy="16" r="2.6" fill="${C.accent}"/>
  <circle cx="26.4" cy="12" r="1.5" fill="${C.accentBright}"/>
</svg>`;

const EYEBROW_RULE = `<span style="display:inline-block;width:18px;height:1px;background:${C.accent};opacity:0.6;vertical-align:middle;margin-right:8px"></span>`;

/** Bulletproof button: solid gold fill, padding lives on the <a>. */
function button(href: string, label: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="display:inline-block">
      <tr>
        <td bgcolor="${C.accent}" style="border-radius:6px">
          <a href="${href}" target="_blank" style="display:inline-block;background:${C.accent};color:${C.bg};text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;padding:13px 34px;border-radius:6px;line-height:1">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Editorial eyebrow label — tracked uppercase gold tag. */
function eyebrow(label: string): string {
  return `${EYEBROW_RULE}<span style="color:${C.accentBright};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase">${label}</span>`;
}

/** Hairline full-width divider. */
const DIVIDER = `<tr><td style="padding:0 40px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:${C.border};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;

function template(children: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <meta name="x-apple-disable-message-reformatting">
  <title>Evalio</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};color:${C.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
  <!-- Outer canvas -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg}">
    <tr>
      <td align="center" style="padding:40px 16px">
        <!-- 560px frame -->
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">

          <!-- Brand lockup -->
          <tr>
            <td style="padding:0 0 28px">
              <table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-block">
                <tr>
                  <td style="vertical-align:middle;padding-right:11px">${LOGO_SVG}</td>
                  <td style="vertical-align:middle">
                    <span style="color:${C.text};font-size:17px;font-weight:600;letter-spacing:-0.02em">Evalio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.card};border:1px solid ${C.border};border-radius:10px;overflow:hidden">
                ${children}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:26px 8px 0">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:0 20px">
                    <!-- Footer nav -->
                    <p style="margin:0 0 16px">
                      <a href="${FRONTEND_URL}/dashboard" style="color:${C.textMuted};font-size:12px;text-decoration:none;margin:0 10px">Dashboard</a>
                      <span style="color:${C.border};font-size:12px">·</span>
                      <a href="${FRONTEND_URL}/interview/new" style="color:${C.textMuted};font-size:12px;text-decoration:none;margin:0 10px">Practice</a>
                      <span style="color:${C.border};font-size:12px">·</span>
                      <a href="${FRONTEND_URL}/pricing" style="color:${C.textMuted};font-size:12px;text-decoration:none;margin:0 10px">Pricing</a>
                      <span style="color:${C.border};font-size:12px">·</span>
                      <a href="${FRONTEND_URL}/contact" style="color:${C.textMuted};font-size:12px;text-decoration:none;margin:0 10px">Contact</a>
                    </p>
                    <p style="color:${C.textFaint};font-size:11.5px;line-height:1.7;margin:0 0 6px">
                      You're receiving this because you have an Evalio account.
                    </p>
                    <p style="color:${C.textFaint};font-size:11px;line-height:1.6;margin:0">
                      &copy; ${YEAR} Evalio &nbsp;·&nbsp; AI-powered interview practice &nbsp;·&nbsp; The interviewer that remembers.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmail(otp: string): string {
  // Split the OTP into individually-styled digit cells for a refined look.
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<td align="center" style="width:46px;height:56px;background:${C.bg};border:1px solid ${C.border};border-radius:8px;color:${C.text};font-family:'SF Mono','SFMono-Regular','Fira Code','Cascadia Code',Menlo,Consolas,monospace;font-size:26px;font-weight:600;letter-spacing:0;text-align:center;vertical-align:middle">${d}</td>`,
    )
    .join('<td style="width:7px">&nbsp;</td>');

  return template(`
    <tr><td style="padding:44px 40px 18px">${eyebrow("Verify your email")}</td></tr>
    <tr><td style="padding:0 40px 8px">
      <h1 style="color:${C.text};font-size:26px;font-weight:600;margin:0 0 12px;letter-spacing:-0.025em;line-height:1.2">
        One code away from<br/>
        <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:${C.accentBright}">your first interview.</span>
      </h1>
      <p style="color:${C.textMuted};font-size:14px;line-height:1.7;margin:0">
        Enter this code to confirm your email and unlock Evalio. It expires in
        <strong style="color:${C.text};font-weight:600">10 minutes</strong>.
      </p>
    </td></tr>

    <!-- Digit strip -->
    <tr><td align="center" style="padding:30px 40px 26px">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;border-collapse:separate;border-spacing:0">
        <tr>${digits}</tr>
      </table>
    </td></tr>

    ${DIVIDER}

    <tr><td style="padding:22px 40px 36px">
      <p style="color:${C.textFaint};font-size:12.5px;line-height:1.7;margin:0;text-align:center">
        Didn't request this code? You can safely ignore this email —
        <br/>no one is signing in with your address.
      </p>
    </td></tr>
  `);
}

function buildResetOtpEmail(otp: string): string {
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<td align="center" style="width:46px;height:56px;background:${C.bg};border:1px solid ${C.border};border-radius:8px;color:${C.text};font-family:'SF Mono','SFMono-Regular','Fira Code','Cascadia Code',Menlo,Consolas,monospace;font-size:26px;font-weight:600;letter-spacing:0;text-align:center;vertical-align:middle">${d}</td>`,
    )
    .join('<td style="width:7px">&nbsp;</td>');

  return template(`
    <tr><td style="padding:44px 40px 18px">${eyebrow("Password reset")}</td></tr>
    <tr><td style="padding:0 40px 8px">
      <h1 style="color:${C.text};font-size:26px;font-weight:600;margin:0 0 12px;letter-spacing:-0.025em;line-height:1.2">
        Let's get you<br/>
        <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:${C.accentBright}">back in.</span>
      </h1>
      <p style="color:${C.textMuted};font-size:14px;line-height:1.7;margin:0">
        Use this code to set a new password. It expires in
        <strong style="color:${C.text};font-weight:600">10 minutes</strong>.
      </p>
    </td></tr>

    <tr><td align="center" style="padding:30px 40px 26px">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;border-collapse:separate;border-spacing:0">
        <tr>${digits}</tr>
      </table>
    </td></tr>

    ${DIVIDER}

    <tr><td style="padding:22px 40px 36px">
      <p style="color:${C.textFaint};font-size:12.5px;line-height:1.7;margin:0;text-align:center">
        If you didn't ask to reset your password,<br/>
        you can safely ignore this email.
      </p>
    </td></tr>
  `);
}

function featureRow(title: string, desc: string, isLast = false): string {
  return `<tr>
    <td style="padding:14px 20px ${isLast ? 4 : 16}px 0">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%">
        <tr>
          <td style="width:26px;vertical-align:top;padding-top:2px">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${C.accent}"></span>
          </td>
          <td style="vertical-align:top">
            <p style="color:${C.text};font-size:13.5px;font-weight:600;margin:0 0 3px;letter-spacing:-0.005em">${title}</p>
            <p style="color:${C.textMuted};font-size:12.5px;line-height:1.55;margin:0">${desc}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function buildWelcomeEmail(name: string): string {
  return template(`
    <tr><td style="padding:44px 40px 16px">${eyebrow("Welcome aboard")}</td></tr>
    <tr><td style="padding:0 40px 12px">
      <h1 style="color:${C.text};font-size:28px;font-weight:600;margin:0 0 12px;letter-spacing:-0.025em;line-height:1.2">
        Hi ${name},<br/>
        <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:${C.accentBright}">practice is temporary.</span><br/>
        <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:${C.text}">Identity is persistent.</span>
      </h1>
      <p style="color:${C.textMuted};font-size:14px;line-height:1.7;margin:0">
        Your email is verified. You're ready to sit across from an interviewer
        that remembers every answer you give — and gets sharper the more you practice.
      </p>
    </td></tr>

    <!-- Primary CTA -->
    <tr><td align="center" style="padding:28px 40px 30px">
      ${button(`${FRONTEND_URL}/dashboard`, "Go to Dashboard")}
    </td></tr>

    ${DIVIDER}

    <!-- What you can do -->
    <tr><td style="padding:26px 40px 6px">
      <p style="color:${C.accentBright};font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 4px">What you can do</p>
    </td></tr>
    <tr><td style="padding:6px 40px 26px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${featureRow("Live AI voice interviews", "Real-time conversations with Gemini. The AI can interrupt mid-answer, push for depth, and adapt to your target role.")}
        ${featureRow("Detailed scoring & feedback", "Scores across six dimensions — communication, technical depth, problem solving, leadership, ownership, decision making.")}
        ${featureRow("Resume-aware questioning", "Upload your resume and the interviewer tailors questions to your real projects and experience, not generics.")}
        ${featureRow("Company-specific practice", "16 real company profiles — Google, Stripe, Meta, Amazon and more — each with its own style and depth.")}
        ${featureRow("Interview memory", "Every session builds context. The interviewer learns how you've changed across dozens of interviews.")}
        ${featureRow("Track progress over time", "Review past interviews, watch your score trends, and see your interview identity emerge.", true)}
      </table>
    </td></tr>

    ${DIVIDER}

    <!-- Sign-off -->
    <tr><td style="padding:22px 40px 36px">
      <p style="color:${C.textMuted};font-size:13px;line-height:1.7;margin:0 0 6px">
        See you in the room,
      </p>
      <p style="color:${C.text};font-size:13px;font-weight:600;margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic">
        — The Evalio Team
      </p>
    </td></tr>
  `);
}

function buildFeedbackThankYouEmail(name: string): string {
  return template(`
    <tr><td style="padding:48px 40px 18px">${eyebrow("Thank you")}</td></tr>
    <tr><td style="padding:0 40px 12px">
      <h1 style="color:${C.text};font-size:28px;font-weight:600;margin:0 0 14px;letter-spacing:-0.025em;line-height:1.2">
        We read every word,<br/>
        <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:${C.accentBright}">${name}.</span>
      </h1>
      <p style="color:${C.textMuted};font-size:14px;line-height:1.7;margin:0">
        Your feedback just shaped what Evalio becomes next. Every submission
        is read and taken seriously — this is how the product earns its memory.
      </p>
    </td></tr>

    <tr><td align="center" style="padding:30px 40px 32px">
      ${button(`${FRONTEND_URL}/dashboard`, "Back to Dashboard")}
    </td></tr>

    ${DIVIDER}

    <tr><td style="padding:22px 40px 40px">
      <p style="color:${C.text};font-size:13px;margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-style:italic">
        — The Evalio Team
      </p>
      <p style="color:${C.textFaint};font-size:12px;line-height:1.6;margin:0">
        Reply to this email anytime. It reaches us directly.
      </p>
    </td></tr>
  `);
}

function buildContactEmail(
  name: string,
  senderEmail: string,
  subject: string,
  message: string,
): string {
  return template(`
    <tr><td style="padding:44px 40px 18px">${eyebrow("Contact form")}</td></tr>
    <tr><td style="padding:0 40px 8px">
      <h1 style="color:${C.text};font-size:22px;font-weight:600;margin:0 0 14px;letter-spacing:-0.02em;line-height:1.3">${subject}</h1>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%">
        <tr>
          <td style="color:${C.textFaint};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding-right:14px;vertical-align:top;width:60px">From</td>
          <td style="color:${C.text};font-size:13.5px;font-weight:600;padding-bottom:2px">${name} <span style="color:${C.textMuted};font-weight:400">&lt;${senderEmail}&gt;</span></td>
        </tr>
      </table>
    </td></tr>

    ${DIVIDER}

    <!-- Message body -->
    <tr><td style="padding:24px 40px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.panel};border:1px solid ${C.border};border-radius:8px">
        <tr>
          <td style="padding:20px 22px">
            <p style="color:${C.textFaint};font-size:10.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 12px">Message</p>
            <p style="color:${C.text};font-size:14px;line-height:1.75;margin:0;white-space:pre-wrap">${message}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 40px 36px">
      <p style="margin:0">${button(`mailto:${senderEmail}`, "Reply by email")}</p>
    </td></tr>
  `);
}

async function bufferEmail(
  to: string,
  subject: string,
  html: string,
  type: string,
): Promise<void> {
  try {
    await prisma.pendingEmail.create({
      data: {
        to,
        subject,
        html,
        type,
        attempts: 1,
        maxAttempts: MAX_RETRIES,
        nextRetryAt: new Date(Date.now() + RETRY_BASE_DELAY_MS),
      },
    });
    logger.info("email.buffered", { to, subject, type });
  } catch (err) {
    logger.error("email.buffer_failed", { to, subject, type, err });
  }
}

export async function flushPendingEmails(): Promise<void> {
  const pending = await prisma.pendingEmail.findMany({
    where: {
      sentAt: null,
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_RETRIES },
    },
    take: 20,
  });

  for (const email of pending) {
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      await prisma.pendingEmail.update({
        where: { id: email.id },
        data: { sentAt: new Date() },
      });
      logger.info("email.flush_success", { id: email.id, to: email.to });
    } catch (err) {
      const nextRetry = new Date(
        Date.now() + RETRY_BASE_DELAY_MS * Math.pow(2, email.attempts),
      );
      await prisma.pendingEmail.update({
        where: { id: email.id },
        data: {
          attempts: { increment: 1 },
          lastError: err instanceof Error ? err.message : String(err),
          nextRetryAt: nextRetry,
        },
      });
      logger.error("email.flush_failed", { id: email.id, to: email.to, err });
    }
  }
}

export async function sendContactEmail(
  name: string,
  senderEmail: string,
  subject: string,
  message: string,
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: Bun.env.TO_EMAIL ?? "evalio@krishlabs.tech",
      replyTo: senderEmail,
      subject: `[Contact] ${subject}`,
      html: buildContactEmail(name, senderEmail, subject, message),
    });
    return true;
  } catch (err) {
    console.error("[email] contact send failed:", err);
    return false;
  }
}

async function sendWithBuffer(
  to: string,
  subject: string,
  html: string,
  type: string,
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    logger.error("email.send_failed", { to, subject, type, err });
    await bufferEmail(to, subject, html, type);
    return false;
  }
}

export async function sendOtpEmail(
  email: string,
  _name: string,
  otp: string,
): Promise<boolean> {
  return sendWithBuffer(
    email,
    "Verify your email — Evalio",
    buildOtpEmail(otp),
    "otp",
  );
}

export async function sendResetOtpEmail(
  email: string,
  _name: string,
  otp: string,
): Promise<boolean> {
  return sendWithBuffer(
    email,
    "Reset your password — Evalio",
    buildResetOtpEmail(otp),
    "password_reset",
  );
}

export async function sendFeedbackThankYouEmail(
  email: string,
  name: string,
): Promise<boolean> {
  return sendWithBuffer(
    email,
    "Thank you for your feedback — Evalio",
    buildFeedbackThankYouEmail(name),
    "feedback",
  );
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
): Promise<boolean> {
  return sendWithBuffer(
    email,
    "Welcome to Evalio — email verified",
    buildWelcomeEmail(name),
    "welcome",
  );
}
