// server.js
// Telegram "contact relay" bot — no database needed. Railway-compatible (long-running server).
//
// Flow:
// 1. A user messages your bot privately.
// 2. Bot sends YOU (the admin) a small info header ("who this is + their ID"),
//    then forwards their actual message right after it.
// 3. You just hit "Reply" (in Telegram) on either of those messages and type your answer.
// 4. Bot detects the reply, figures out who to send it to, and delivers it —
//    feels like a live chat, with zero storage.

import express from 'express';

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 3000;

const call = (method, payload) =>
  fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

app.get('/', (req, res) => {
  res.send('Bot is running ✅');
});

app.post('/api/webhook', async (req, res) => {
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

    text: `👋 Hi ${name}!

          Welcome to the official Falcon Crypto Signals Support Bot.

          If you have any questions, encounter an issue, or would like to share feedback, simply send us a message.

          ✅ Before contacting support, please confirm that you're using our official Signals Bot: @Falcon_Crypto_Signals_bot

          If you're using a different bot, please switch to the official one before requesting support.

          🚀 We're here to help!`,
    // Handle other commands if needed

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
    console.error(err);
    return res.status(200).send('error handled');
  }
});

app.listen(PORT, () => {
  console.log(`Bot server listening on port ${PORT}`);
});
