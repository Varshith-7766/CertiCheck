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
  await t.sendMail({
    from: config.smtp.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export { isDevMode };