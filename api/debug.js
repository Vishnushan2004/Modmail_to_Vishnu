// api/debug.js
// Visit https://<your-domain>/api/debug in a browser to sanity-check your setup.
// Never prints the actual token — only whether it's present, plus live
// webhook info straight from Telegram.

export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_ID = process.env.ADMIN_ID;

  const result = {
    env: {
      BOT_TOKEN_set: !!BOT_TOKEN,
      BOT_TOKEN_preview: BOT_TOKEN ? `${BOT_TOKEN.slice(0, 6)}...${BOT_TOKEN.slice(-4)}` : null,
      ADMIN_ID_set: !!ADMIN_ID,
      ADMIN_ID_value: ADMIN_ID || null,
    },
    webhook: null,
    botInfo: null,
  };

  if (BOT_TOKEN) {
    try {
      const [webhookRes, meRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`).then((r) => r.json()),
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then((r) => r.json()),
      ]);
      result.webhook = webhookRes.result;
      result.botInfo = meRes.result;
    } catch (err) {
      result.error = String(err);
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify(result, null, 2));
}
