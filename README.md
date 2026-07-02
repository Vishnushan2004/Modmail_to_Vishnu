# Telegram Contact Relay Bot (Railway version, no database)

Members message your bot privately → the bot forwards it to you → you **reply**
to that message in Telegram → the bot sends your reply back to that person.

This version runs as a normal always-on Node/Express server, for **Railway**
(not Vercel — Railway needs a persistent process, not a serverless function).

## 1. Create the bot
1. Talk to **@BotFather** on Telegram → `/newbot` → copy the **bot token**.

## 2. Get your numeric Telegram ID
Talk to **@userinfobot** → copy the `id` it gives you. This is `ADMIN_ID`.

## 3. Deploy to Railway
1. Push this project to a GitHub repo.
2. On railway.app → **New Project** → **Deploy from GitHub repo** → pick it.
3. Railway will detect Node automatically and now finds a proper `start`
   script (`npm start` → `node server.js`), so the build will succeed.

## 4. Set environment variables
In Railway: your service → **Variables** tab → add:

| Name        | Value                          |
|-------------|----------------------------------|
| `BOT_TOKEN` | token from BotFather             |
| `ADMIN_ID`  | your numeric Telegram user ID    |

Railway auto-redeploys after you save variables.

## 5. Get your public URL
Railway → your service → **Settings → Networking → Generate Domain**.
You'll get something like `https://your-app.up.railway.app`.

## 6. Set the Telegram webhook
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.up.railway.app/api/webhook"
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## 7. Test
DM your bot from another account → you get a header + forwarded message →
reply to it → sender gets your reply.

## How replies route without a database
Same trick as before: Telegram attaches `forward_from` to forwarded messages
(when the sender allows it), and a fallback `🆔 ID: <number>` is embedded in
the header message text, parsed by regex if `forward_from` isn't available.
