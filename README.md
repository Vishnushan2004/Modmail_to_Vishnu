# Telegram Contact Relay Bot (no database)

Members message your bot privately → the bot forwards it to you → you **reply**
to that message in Telegram → the bot sends your reply back to that person.
Feels like a live chat, but there's zero storage — everything needed to route
a reply is embedded in the messages themselves.

## 1. Create the bot

1. Open Telegram, talk to **@BotFather**.
2. `/newbot` → follow prompts → copy the **bot token** it gives you
   (looks like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

## 2. Get your own numeric Telegram ID

1. Talk to **@userinfobot** (or **@RawDataBot**) — it replies with your `id`.
2. Save that number. This is `ADMIN_ID`.

## 3. Deploy to Vercel

**Option A — Vercel CLI**
```bash
npm i -g vercel
cd telegram-relay-bot
vercel
```
Follow the prompts (link/create a project). It'll give you a production URL
like `https://your-project.vercel.app`.

**Option B — GitHub + Vercel dashboard**
1. Push this folder to a new GitHub repo.
2. Go to vercel.com → **Add New Project** → import that repo → Deploy.

## 4. Set environment variables

In the Vercel dashboard: **Project → Settings → Environment Variables**, add:

| Name        | Value                                  |
|-------------|-----------------------------------------|
| `BOT_TOKEN` | the token from BotFather                |
| `ADMIN_ID`  | your numeric Telegram user ID           |

Redeploy after adding them (Vercel → Deployments → ⋯ → Redeploy).

## 5. Point Telegram at your bot (set the webhook)

Run this once (replace both placeholders), from any terminal:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-project>.vercel.app/api/webhook"
```

You should get back `{"ok":true,"result":true,...}`.

Check it worked any time with:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## 6. Try it

1. From a **different** Telegram account (not the bot owner), DM your bot anything.
2. You (the admin) should receive:
   - a small header: `📩 New message from Jane (@jane) 🆔 ID: 123456789`
   - the forwarded message itself.
3. **Reply** (swipe or long-press → Reply) to either of those messages with your answer.
4. The sender receives your reply instantly, in their private chat with the bot.

## How replies get routed without a database

When you reply to a message in Telegram, the update includes
`message.reply_to_message`. The bot checks, in order:

1. `reply_to_message.forward_from.id` — Telegram automatically attaches
   this when it forwards a message (unless the sender has "hide forwards"
   privacy on).
2. A fallback: the header message text always contains `🆔 ID: <number>`,
   which the bot extracts with a regex if step 1 isn't available.

Either way, no external storage is needed — the routing info lives inside
the Telegram messages themselves.

## Notes / things you can tweak

- **Group vs. DM**: this only relays *private* messages sent to the bot,
  as you described. If you also want to catch messages posted in the group
  itself, that's a different flow (happy to add it if you want).
- **Media**: photos, videos, voice notes, documents, stickers — all work,
  since `forwardMessage`/`copyMessage` handle any message type.
- **Blocked bot**: if a user has blocked the bot, your reply attempt will
  get a Telegram API error, and the bot will tell you in your chat.
- **Multiple admins**: currently supports one `ADMIN_ID`. If you want a
  small team to share the inbox, that's easy to extend — just say the word.
