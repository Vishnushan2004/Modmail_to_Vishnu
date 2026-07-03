// api/webhook.js
// Telegram "modmail" relay bot — no database needed.
//
// Flow:
// 1. A user DMs your bot.
// 2. Bot sends YOU (the admin) a header ("who this is + their ID"), then
//    forwards their actual message right after it.
// 3. You hit "Reply" (in Telegram) on either message and type your answer.
// 4. Bot detects the reply, works out who to send it to, and delivers it.
//
// This file logs every step to the Vercel function logs (Project → Deployments
// → latest → Functions → webhook → Logs) so failures are visible instead of silent.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running ✅');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_ID = process.env.ADMIN_ID;

  if (!BOT_TOKEN || !ADMIN_ID) {
    console.error('Missing env vars', { hasToken: !!BOT_TOKEN, hasAdmin: !!ADMIN_ID });
    // Still 200 so Telegram doesn't retry-storm us, but this is logged loudly.
    return res.status(200).send('missing env vars — check /api/debug');
  }

  const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

  const call = async (method, payload) => {
    const r = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!data.ok) {
      console.error(`Telegram API error on ${method}:`, data.description);
    }
    return data;
  };

  try {
    const update = req.body;
    console.log('Incoming update:', JSON.stringify(update));

    const message = update?.message;
    if (!message) return res.status(200).send('ok');

    const chatId = message.chat.id;
    const isFromAdmin = String(chatId) === String(ADMIN_ID);

    // ---------- Message from YOU (the admin) ----------
    if (isFromAdmin) {
      const replyTo = message.reply_to_message;

      if (!replyTo) {
        await call('sendMessage', {
          chat_id: ADMIN_ID,
          text:
            'ℹ️ Reply directly (swipe / long-press → Reply) to a forwarded user message to send your answer back to them.',
        });
        return res.status(200).send('ok');
      }

      let targetId = null;

      if (replyTo.forward_from) {
        targetId = replyTo.forward_from.id;
      } else {
        const text = replyTo.text || replyTo.caption || '';
        const match = text.match(/🆔\s*ID:\s*(\d+)/);
        if (match) targetId = match[1];
      }

      if (targetId) {
        const result = await call('copyMessage', {
          chat_id: targetId,
          from_chat_id: chatId,
          message_id: message.message_id,
        });

        if (!result.ok) {
          await call('sendMessage', {
            chat_id: ADMIN_ID,
            text: `⚠️ Couldn't deliver that reply. Telegram said: ${result.description}`,
          });
        }
      } else {
        await call('sendMessage', {
          chat_id: ADMIN_ID,
          text:
            "⚠️ Couldn't identify the original sender for this reply. Make sure you're replying to a message the bot forwarded to you.",
        });
      }

      return res.status(200).send('ok');
    }

    // ---------- Message from a regular user ----------
    const user = message.from;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = user.username ? `@${user.username}` : 'no username';

    if (message.text === '/start') {
      await call('sendMessage', {
        chat_id: chatId,
        text: "👋 Hi! Send me a message and I'll pass it along. You'll get a reply here.",
      });
      return res.status(200).send('ok');
    }

    await call('sendMessage', {
      chat_id: ADMIN_ID,
      text: `📩 New message from ${name} (${username})\n🆔 ID: ${user.id}`,
    });

    const fwd = await call('forwardMessage', {
      chat_id: ADMIN_ID,
      from_chat_id: chatId,
      message_id: message.message_id,
    });

    if (!fwd.ok) {
      await call('copyMessage', {
        chat_id: ADMIN_ID,
        from_chat_id: chatId,
        message_id: message.message_id,
      });
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('Handler crashed:', err);
    return res.status(200).send('error handled');
  }
}
