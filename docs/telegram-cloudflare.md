# Telegram and Cloudflare setup

Bot: `@bridge_lah_bot`  
Repository: `https://github.com/tskwilliam/Bridge_Lah_Bot`

The code now has a Telegram client and an authoritative Cloudflare Worker. A group gets one Durable Object, which stores any number of independent games, the group's leaderboard, and each player's last-started settings. Each game's 52-card deal happens in the Worker; each player receives only their own hand. WebSockets carry table updates to all four players. The ordinary browser URL remains a local sample preview.

## Current deployment status

The Worker and static assets were deployed as `bridge-lah` on 26 September 2026. The registered account subdomain is `bridge-lah-bot`, so the app URL is `https://bridge-lah.bridge-lah-bot.workers.dev`. Both the homepage and `/api/health` return HTTP 200. All three secrets (`BOT_TOKEN`, `LINK_SECRET`, and `TELEGRAM_WEBHOOK_SECRET`) are stored in Cloudflare. The generated webhook secret is also saved in the Git-ignored `.local/webhook-secret.txt`. Telegram accepted `https://bridge-lah.bridge-lah-bot.workers.dev/telegram/webhook`; the one-time registration endpoint was removed. BotFather's Direct Link Mini App is `https://t.me/bridge_lah_bot/play`, matching the Worker's `play` short name. The remaining check is the group `/play` flow with real members.

To verify the live game, add the bot as a group administrator and send `/play` in the group. The bot sends game links like `https://t.me/bridge_lah_bot/play?startapp=...`.

## Deploy

1. In this directory, run `npm install`, `npm run build`, and `npm run worker:check`.
2. Run `npx wrangler login` and sign into your Cloudflare account. Then run `npx wrangler deploy`. This publishes the Worker and the Vite assets together. Keep the resulting HTTPS `workers.dev` URL.
3. In the Cloudflare Worker, add three **secrets** (not plain variables): `BOT_TOKEN` (your BotFather HTTP API token), `LINK_SECRET` (a long random string), and `TELEGRAM_WEBHOOK_SECRET` (a separate random string using letters, numbers, `_`, or `-`). You can add each with `npx wrangler secret put NAME`, which prompts for the value. The bot token must never go into GitHub, `.env`, `wrangler.jsonc` variables, or a `VITE_*` variable.
4. Deploy again if Cloudflare asks you to after adding secrets. Check `https://YOUR-WORKER-URL/api/health`; it should return `{"ok":true}`.
5. In [BotFather](https://t.me/BotFather), select `@bridge_lah_bot`, choose **Mini App** > **Create Direct Link**, enter the HTTPS Worker URL, and choose short name `play`. This enables the `https://t.me/bridge_lah_bot/play?startapp=...` links sent by the bot.
6. Register `https://YOUR-WORKER-URL/telegram/webhook` with Telegram's [`setWebhook`](https://core.telegram.org/bots/api#setwebhook), passing the same `TELEGRAM_WEBHOOK_SECRET` as `secret_token`. A PowerShell example is below. Only the `message` update type is needed.
7. Add `@bridge_lah_bot` to the Telegram group **as an administrator**. Telegram only guarantees [`getChatMember`](https://core.telegram.org/bots/api#getchatmember) for checking other users when the bot is an administrator. Send `/play` in the group. The bot replies with an **Open Bridge Lah!** button. The first player opens it and taps **Create game**. The bot posts a unique **Take a seat** button for that game; three other members use it to join.

PowerShell webhook registration (the token and secret are entered at prompts, not written into the repository):

```powershell
$botToken = Read-Host 'Bot token'
$hookSecret = Read-Host 'Webhook secret'
$workerUrl = Read-Host 'Worker HTTPS URL (without trailing slash)'
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Body @{ url = "$workerUrl/telegram/webhook"; secret_token = $hookSecret; allowed_updates = '["message"]' }
Remove-Variable botToken, hookSecret
```

`LINK_SECRET` and `TELEGRAM_WEBHOOK_SECRET` must remain stable across redeployments; changing them invalidates existing group links and webhook requests respectively. The `BOT_USERNAME` variable in `wrangler.jsonc` is public.

## Test with a small group

Use four real Telegram accounts. Check that all four see the same seats, bid, cards on the table, tricks, and result, but only their own hand. Then close and reopen a player's game using **Resume game**. Verify the dealer's seat swap, kick, and settings; another player's quit; reshuffle; two simultaneous games in the same group; and the group leaderboard. This live Telegram test requires a deployed Worker and cannot be completed by the local preview.

The bot's profile and bare Direct Link have no group link by themselves, so open the app through the `/play` group message or a game invitation. A browser opened outside Telegram displays the local design preview.

References: [Telegram Mini Apps and direct links](https://core.telegram.org/bots/webapps), [Cloudflare Worker static assets](https://developers.cloudflare.com/workers/static-assets/), [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
