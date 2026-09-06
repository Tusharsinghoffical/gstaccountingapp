/**
 * Universal Email Sender for GST Ledger SaaS
 * Supports:
 * 1. Resend (HTTP API via RESEND_API_KEY - no credit card required on free tier)
 * 2. Nodemailer / Custom SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM)
 * 3. Safe Development Console Logger (prints activation link to terminal when no email credentials exist)
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: "resend" | "smtp" | "console";
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<SendEmailResult> {
  const fromEmail = process.env.EMAIL_FROM || "GST Ledger <noreply@gstledger.local>";
  const resendApiKey = process.env.RESEND_API_KEY;

  // 1. Try Resend if configured
  if (resendApiKey && resendApiKey.startsWith("re_")) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ""),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          messageId: data.id,
          provider: "resend",
        };
      } else {
        const errText = await response.text();
        console.warn(`[Resend Error] Failed to send email: ${errText}. Falling back...`);
      }
    } catch (err: unknown) {
      console.warn("[Resend Error] Request failed:", err);
    }
  }

  // 2. Try SMTP if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      // Lazy import nodemailer if installed
      const nodemailer = await import("nodemailer").catch(() => null);
      if (nodemailer) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: fromEmail,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ""),
        });

        return {
          success: true,
          messageId: info.messageId,
          provider: "smtp",
        };
      }
    } catch (err: unknown) {
      console.warn("[SMTP Error] Failed to send email:", err);
    }
  }

  // 3. Development / Sandbox Console Fallback
  // Useful during automated testing and local development
  console.log("\n==================== [TRANSACTIONAL EMAIL DISPATCH] ====================");
  console.log(`TO:       ${to}`);
  console.log(`SUBJECT:  ${subject}`);
  console.log("------------------------------------------------------------------------");
  console.log(text || html.replace(/<[^>]*>?/gm, "").trim());
  console.log("========================================================================\n");

  return {
    success: true,
    messageId: `console-${Date.now()}`,
    provider: "console",
  };
}

/**
 * Generate standard HTML email template
 */
export function getEmailTemplate(title: string, contentHtml: string, actionText?: string, actionUrl?: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 18px; font-weight: 800; color: #4f46e5; text-decoration: none; display: inline-block; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 8px 0 24px 0; }
    .footer { font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
    .raw-url { font-size: 11px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <a href="#" class="logo">⚡ GST Ledger</a>
    <h1>${title}</h1>
    ${contentHtml}
    ${actionText && actionUrl ? `<a href="${actionUrl}" class="btn">${actionText}</a>` : ""}
    ${actionUrl ? `<p style="font-size: 11px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser:</p><div class="raw-url">${actionUrl}</div>` : ""}
    <div class="footer">
      This is an automated system notification from GST Ledger. If you did not request this, please safely ignore this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}
