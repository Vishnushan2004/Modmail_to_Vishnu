# Modmail Relay Bot (no database)

Members message your bot privately → it relays to you → you **reply** in
Telegram → your reply goes straight back to them. No database — the routing
info lives inside the messages themselves.

```
modmail-bot/
├── api/
│   ├── webhook.js   ← the bot's brain (Telegram calls this)
│   └── debug.js     ← visit in a browser to sanity-check your setup
├── public/
│   └── index.html   ← status page at your root domain
├── package.json
└── .gitignore
```

## 1. Create the bot

Talk to **@BotFather** on Telegram → `/newbot` → copy the token it gives you.

## 2. Get your numeric Telegram ID

Talk to **@userinfobot** → it replies with your `id`. That's `ADMIN_ID`.

## 3. Deploy to Vercel

```bash
npm i -g vercel
cd modmail-bot
vercel
```
or import the GitHub repo at vercel.com → **Add New Project**.

**Important:** make sure `api/webhook.js` stays inside the `api/` folder in
your repo — Vercel only turns files under `/api` into working endpoints.
A `webhook.js` sitting at the repo root will 404.

## 4. Set environment variables

Vercel dashboard → **Project → Settings → Environment Variables**:

| Name        | Value                          |
|-------------|----------------------------------|
| `BOT_TOKEN` | token from BotFather            |
| `ADMIN_ID`  | your numeric Telegram user ID   |

Then **redeploy** (Deployments → ⋯ → Redeploy) — env vars only apply to
deployments made after they're added.

## 5. Point Telegram at your bot

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-domain>.vercel.app/api/webhook"
```

Expect: `{"ok":true,"result":true,"description":"Webhook was set"}`

## 6. Verify everything end-to-end

Open `https://<your-domain>.vercel.app/api/debug` in a browser. It shows:
- whether `BOT_TOKEN` / `ADMIN_ID` are actually set on the deployment
- Telegram's own record of your webhook (`url`, `pending_update_count`,
  `last_error_message` if any delivery failed)
- your bot's identity (`getMe`), confirming the token is valid

If `last_error_message` mentions anything, that's Telegram telling you
exactly why deliveries are failing — usually a wrong URL or an expired token.

## 7. Test the live flow

1. DM your bot from a **different** Telegram account.
2. Your admin chat should get a header (`📩 New message from...`) + the
   forwarded message.
3. Reply to it — the sender gets it back instantly.

## Troubleshooting checklist

- **`/api/webhook` 404s** → the file isn't inside `api/` in the deployed
  repo, or the deployment failed. Check Deployments → latest → Source.
- **`/api/debug` shows `BOT_TOKEN_set: false`** → env var isn't set, or you
  didn't redeploy after adding it.
- **`getWebhookInfo` shows a `last_error_message`** → Telegram is telling
  you the exact delivery failure (bad URL, timeout, wrong token, etc).
- **Bot receives messages but never replies to a reply** → check the
  function logs (Deployments → latest → Functions → `webhook` → Logs) for
  `Telegram API error on ...` lines — every failed call is logged there.
- **Nothing shows in logs at all** → the webhook was never actually set, or
  is pointed at the wrong URL. Re-run step 5.

## Notes

- Only relays *private* DMs to the bot, not group messages, per the original brief.
- Handles all message types (photos, video, voice, docs, stickers) via
  `forwardMessage` / `copyMessage`.
- Single admin only. Say the word if you want a small team sharing the inbox.
