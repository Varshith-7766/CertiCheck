import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config.js";

let transporter: Transporter | null = null;
let mailerInitialized = false;

function getTransporter(): Transporter | null {
  if (!mailerInitialized) {
    const { smtp } = config;
    if (smtp.host && smtp.user) {
      try {
        transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          auth: { user: smtp.user, pass: smtp.pass },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          // Force IPv4 — Render's network can't reach Gmail over IPv6.
          family: 4,
        });
      } catch (err) {
        console.error("[mailer] Failed to init SMTP transport:", err);
        transporter = null;
      }
    }
    mailerInitialized = true;
  }
  return transporter;
}

function isDevMode(): boolean {
  return !getTransporter();
}

/**
 * Send an email. When SMTP is not configured (dev mode) the email is
 * logged to the server console so flows work without credentials.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log("[mailer:dev-mode]");
    console.log(`  To:      ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body:    ${(opts.text || opts.html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()}`);
    return;
  }
  console.log(`[mailer] Sending email to ${opts.to} — subject: "${opts.subject}"`);
  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log(`[mailer] Email sent successfully — messageId: ${info.messageId}, response: ${info.response}`);
  } catch (err: any) {
    console.error(`[mailer] FAILED to send email to ${opts.to}`);
    console.error(`[mailer] Error name: ${err.name}`);
    console.error(`[mailer] Error message: ${err.message}`);
    if (err.code) console.error(`[mailer] Error code: ${err.code}`);
    if (err.response) console.error(`[mailer] SMTP response: ${err.response}`);
    if (err.responseCode) console.error(`[mailer] SMTP responseCode: ${err.responseCode}`);
    throw err;
  }
}

/**
 * Verify SMTP connectivity by running transporter.verify().
 * Returns { ok: true } or { ok: false, error: string }.
 * NOTE: Gmail sometimes hangs on verify() even when sendMail works.
 * This endpoint has its own timeout to avoid blocking the server.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    return { ok: false, error: "No SMTP transporter — check SMTP_HOST / SMTP_USER env vars" };
  }
  try {
    console.log("[mailer:verify] Verifying SMTP connection...");
    // Race against a 20s timeout so we don't hang if Gmail is slow
    await Promise.race([
      t.verify(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timed out after 20s")), 20000)
      ),
    ]);
    console.log("[mailer:verify] SMTP connection verified OK");
    return { ok: true };
  } catch (err: any) {
    console.error(`[mailer:verify] SMTP verification failed: ${err.message}`);
    if (err.code) console.error(`[mailer:verify] Error code: ${err.code}`);
    if (err.response) console.error(`[mailer:verify] SMTP response: ${err.response}`);
    return { ok: false, error: err.message };
  }
}

export { isDevMode };