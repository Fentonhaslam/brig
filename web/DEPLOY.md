# Deploying Brig online

The game is a static Vite build (in `dist/`) backed by your Supabase project
(`lntclkaxyipifrsspatd`). The Supabase **URL + publishable key are public** and
already baked into the build (`.env.production`), so any static host works.

## 1. Two quick Supabase settings (one-time)

In the Supabase dashboard for the project:

1. **Make signups instant (recommended for a game).**
   Authentication → Sign In / Providers → **Email** → turn **OFF "Confirm email"**.
   Now you and your brother can register and play immediately. (If you leave it
   ON, new players must click a confirmation link emailed to them — also works,
   just slower, and the free tier rate-limits those emails.)

2. **After you deploy (step 2), set the site URL.**
   Authentication → URL Configuration → set **Site URL** to your deployed URL
   (e.g. `https://brig.vercel.app`) and add it under **Redirect URLs**.

## 2. Deploy (free, pick one)

From the `web/` folder:

**Vercel (recommended)**
```bash
npx vercel --prod
```
First run asks you to log in (browser) and accept defaults — it detects Vite,
builds, and gives you a public `https://…vercel.app` URL.

**Netlify**
```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```
(or drag the `web/dist` folder onto https://app.netlify.com/drop)

**Cloudflare Pages**
```bash
npm run build
npx wrangler pages deploy dist
```

Send your brother the URL — he signs up, picks the name he sails under, and
he's in the same world as you.

## Running locally
```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

## Notes
- The DB password you shared is **sensitive** — rotate it in
  Project Settings → Database → Reset password once you're set up. The app does
  not need it (it only uses the public key).
- Re-apply schema after edits: `REF=lntclkaxyipifrsspatd PASS=... node scripts/apply-schema.mjs`
