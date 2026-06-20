const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM || 'FlixHome <onboarding@resend.dev>';

async function sendUploadComplete(toEmail, filename, cdnUrl) {
  const resend = getResend();
  if (!resend) return;

  const sizeless = filename.replace(/\.[^.]+$/, '').replace(/\./g, ' ').replace(/_/g, ' ');

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `✅ Upload concluído: ${sizeless}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#141414;color:#e5e5e5;border-radius:12px;padding:32px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="width:36px;height:36px;border-radius:8px;background:#E50914;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:900;font-size:18px;">F</span>
          </div>
          <span style="font-size:16px;font-weight:900;letter-spacing:2px;">FLIXHOME</span>
        </div>

        <h2 style="margin:0 0 8px;font-size:20px;">Upload concluído!</h2>
        <p style="color:#aaa;margin:0 0 20px;font-size:14px;">O arquivo foi enviado com sucesso para o servidor.</p>

        <div style="background:#1f1f1f;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Arquivo</div>
          <div style="font-size:15px;font-weight:600;word-break:break-all;">${filename}</div>
        </div>

        <a href="${cdnUrl}" style="display:inline-block;background:#E50914;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;">
          Ver arquivo
        </a>

        <p style="color:#555;font-size:11px;margin-top:24px;margin-bottom:0;">
          FlixHome Admin · Notificação automática
        </p>
      </div>
    `,
  });
}

module.exports = { sendUploadComplete };
