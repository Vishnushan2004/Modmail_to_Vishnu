// api/webhook.js
// Telegram "contact relay" bot — no database needed.
//
// Flow:
// 1. A user messages your bot privately.
// 2. Bot sends YOU (the admin) a small info header ("who this is + their ID"),
//    then forwards their actual message right after it.
// 3. You just hit "Reply" (in Telegram) on either of those messages and type your answer.
// 4. Bot detects the reply, figures out who to send it to, and delivers it —
//    feels like a live chat, with zero storage.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running ✅');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_ID = process.env.ADMIN_ID;
  const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

  const call = (method, payload) =>
    fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

  try {
    const update = req.body;
    const message = update?.message;
    if (!message) return res.status(200).send('ok');

    const chatId = message.chat.id;
    const isFromAdmin = String(chatId) === String(ADMIN_ID);

    // ---------- Message from YOU (the admin) ----------
    if (isFromAdmin) {
      const replyTo = message.reply_to_message;

      if (!replyTo) {
        // Not a reply — just remind how it works.
        await call('sendMessage', {
          chat_id: ADMIN_ID,
          text:
            'ℹ️ Reply directly (swipe / long-press → Reply) to a forwarded user message to send your answer back to them.',
        });
        return res.status(200).send('ok');
      }

      // Try to find who the original sender was.
      let targetId = null;

      if (replyTo.forward_from) {
        // Works when the user's privacy settings allow showing forward origin.
        targetId = replyTo.forward_from.id;
      } else {
        // Fallback: parse the ID we embedded in our own header/caption text.
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
            text: `⚠️ Couldn't deliver that reply (user may have blocked the bot). Telegram said: ${result.description}`,
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

    // 1) Info header so you always know who it is + their numeric ID (fallback for replies)
    await call('sendMessage', {
      chat_id: ADMIN_ID,
      text: `📩 New message from ${name} (${username})\n🆔 ID: ${user.id}`,
    });

    // 2) The actual message, forwarded (keeps forward_from metadata when available)
    const fwd = await call('forwardMessage', {
      chat_id: ADMIN_ID,
      from_chat_id: chatId,
      message_id: message.message_id,
    });

    if (!fwd.ok) {
      // Extremely rare fallback (e.g. some restricted content) — copy instead.
      await call('copyMessage', {
        chat_id: ADMIN_ID,
        from_chat_id: chatId,
        message_id: message.message_id,
      });
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    // Always 200 so Telegram doesn't hammer retries.
    return res.status(200).send('error handled');
  }
}
