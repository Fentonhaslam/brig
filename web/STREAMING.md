# Streaming Brig on Twitch

The live build is at **https://web-black-nu-50.vercel.app/** and viewers can
play directly in their browser — sign-up takes about 15 seconds (email +
password + sail-name). This guide is the shortest path from "I want to stream"
to "viewers are in the world with me."

## 1. The link viewers click

Append `?stream=1` to the play URL when posting it anywhere your viewers will
see it (panels, chat command, stream title). Visitors who arrive that way get
a small top banner nudging them to sign in:

```
https://web-black-nu-50.vercel.app/?stream=1
```

The banner is one-time per browser session, dismissible, and never blocks the
game underneath. Without `?stream=1` the URL still works — it just skips the
banner.

## 2. OBS scene (one-time setup)

A minimal, readable scene for browser-game streaming:

| Source           | Type             | Notes                                                                                  |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------- |
| **Game**         | Browser source¹  | URL = play URL · 1920×1080 · check "Refresh browser when scene becomes active"         |
| **Webcam**       | Video capture    | Bottom-right, ~280×210, light border                                                   |
| **Mic**          | Audio input      | Noise-suppression filter + a soft gate                                                 |
| **Chat overlay** | Browser source²  | (Optional) so viewers see chat reactions reflected in the stream                       |
| **Title bar**    | Text + colour BG | Top strip, e.g. "BRIG · live dev + open playtest · join: web-black-nu-50.vercel.app"   |

¹ Browser source instead of window capture: cleaner crops, no other-app
spillover, GPU-accelerated, and OBS can refresh it without bringing the game
window forward.
² Use a chat widget like StreamElements / Nightbot / KapChat — see step 4.

**Capture target:** prefer the browser source over capturing the game window —
window captures break on minimise/refocus and surface notifications. Set the
browser source's resolution to your canvas (1920×1080 typical) and let OBS do
the scaling.

**Performance:** the game runs at 60 fps natively; OBS browser source at 60 fps
+ 1080p encode + Chrome's compositor adds up. If you see frame drops, drop the
browser source to 30 fps and let the game's own loop stay at 60.

## 3. Stream title + Twitch panels

Suggested title (keep the URL in it — Twitch makes URLs clickable in the
"About" panel and search results):

```
BRIG — live dev of a multiplayer Age-of-Sail game · play with me: web-black-nu-50.vercel.app
```

Twitch category: **Software and Game Development** (best discoverability for
dev-streaming + live playtest), **Games + Demos** category as a tag if you can.

### Panel: "Play the game" (Twitch → Edit Panels)

```markdown
**▶ Play right now — free, in your browser**

https://web-black-nu-50.vercel.app/?stream=1

Sign up (email + password + the name you sail under) and you're on the same
sea as everyone else watching. Inscribe a memory-stone at the keep on
Hispaniola and it stands there for everyone, forever.
```

### Panel: "About Brig"

```markdown
A 3D world set on a Spanish nao departing Sevilla for the Indies, 1519.
Build, sail, fish, fight off pirates, and write the world's history at the
keep. Built live on stream with Claude Code.

Three.js · Supabase · Vite
```

### Panel: "Rules"

```markdown
- Be civil. Stones you raise are visible to every player, forever.
- Spam, slurs, or off-topic ranting → I'll hide the stone and you'll
  need to wait an hour before raising another.
- One inscription per hour (per account) is the soft cap.
- Have fun. This is a tiny game and you're shaping it.
```

## 4. Chat bot — `!play` command

If you run **Nightbot** (free, easiest), add this from the dashboard:

```
!addcom !play 🌊 Sail with me — sign up (15s) and you're on the same sea:
https://web-black-nu-50.vercel.app/?stream=1
```

Equivalent for **StreamElements**:

```
!command add !play 🌊 Sail with me — sign up (15s) and you're on the same sea: https://web-black-nu-50.vercel.app/?stream=1
```

If you don't want a bot, Twitch's built-in chat commands work too — slash any
mod can run `/announce ...` to highlight the link in chat.

## 5. Moderation during the stream

The world's chronicle (the memory-stones at the keep) is the one piece of
shared state where griefing matters — text is visible to every player forever.
The defences:

- **Server rate-limit:** any non-admin account is capped at **10 stones per
  hour**. Sneakier griefers (multiple accounts) still get caught by the next
  lever.
- **Admin hide:** as an admin, press **Shift+M** mid-game to open the
  moderation panel. You'll see every entry newest-first; hit `HIDE` and the
  stone vanishes from the world for everyone (the row stays in the DB so you
  can `RESTORE` later if you hid the wrong one).
- **Becoming an admin:** in Supabase SQL editor, run

  ```sql
  update public.profiles set is_admin = true where handle = 'YourSailName';
  ```

  You'll be the admin on next sign-in. The `⚓ name ✦` star confirms it on
  the sign-in button.

## 6. Pre-stream checklist (30 seconds)

- [ ] OBS scene loaded; browser source pointed at the play URL with `?stream=1`
- [ ] Signed in as your admin account (Shift+M opens the panel — confirms it)
- [ ] `!play` command set in chat bot
- [ ] Twitch title contains the URL
- [ ] Mic + webcam levels OK
- [ ] Latency mode set to **Low Latency** in Twitch dashboard (so you can talk
      to viewers about the world they're sailing in with ~3s delay instead of
      ~15s)
