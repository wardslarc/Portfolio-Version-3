# Carls Dale Escalo: Portfolio v3

Personal portfolio for [carlsdaleescalo.com](https://www.carlsdaleescalo.com). It's a single Next.js app: the page and the contact API ship together as one Vercel deployment.

## Stack

- **Next.js 16** (App Router, Turbopack) with React 19 and TypeScript
- **Node.js** route handler for the contact form (`src/app/api/contact/route.ts`)
- **MongoDB Atlas** to store contact messages
- **Resend** (optional) to email new messages
- **Vercel** for hosting, **Cloudflare** for DNS

## Project layout

```text
src/
  app/
    layout.tsx           # fonts, metadata, no-flash theme script
    page.tsx             # the one-page site
    globals.css          # design tokens (light + dark) and all styles
    api/contact/route.ts # POST /api/contact → validate, rate-limit, save, notify
    robots.ts, sitemap.ts
  components/            # Header, Intro, Work, Experience/Skills, Contact
  content/               # edit these to update the site: site, projects, experience
  lib/
    mongodb.ts           # cached MongoClient
    contact.ts           # zod schema, IP hashing, Resend notification
public/
  Escalo-CarlsDale_Resume.pdf
```

To change what the site says, edit the files in `src/content/`. You don't need to touch the components.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI etc.
npm run dev
```

Open http://localhost:3000. The contact form returns a "not available" message until `MONGODB_URI` is set.

## How the contact API works

1. The request is validated with zod (name, email, message, plus a hidden honeypot field).
2. It allows 3 messages per visitor every 10 minutes. Visitors are identified by a salted hash of their IP, and raw IPs are never stored. Each attempt increments a counter in the `rate_limits` collection in one atomic step, so the limit holds across serverless instances and against bursts of parallel requests. A TTL index deletes old counters automatically.
3. Each message is saved to the `messages` collection.
4. If the `RESEND_*` variables are set, you get an email with reply-to set to the sender. If the email fails, the message is still saved.

## Deploying to Vercel

1. Import this repo in Vercel. It detects Next.js automatically.
2. Add the variables from `.env.example` under **Settings → Environment Variables**.
3. In MongoDB Atlas, go to **Network Access** and allow Vercel to connect (`0.0.0.0/0`, or Vercel's static IPs on paid plans).

## Pointing carlsdaleescalo.com (Cloudflare) at Vercel

1. In Vercel, go to **Settings → Domains** and add both `carlsdaleescalo.com` and `www.carlsdaleescalo.com`. Set `www` as primary, because the site's metadata uses `https://www.carlsdaleescalo.com`.
2. In Cloudflare DNS, add these records:

   | Type  | Name | Content                | Proxy status |
   |-------|------|------------------------|--------------|
   | A     | @    | `76.76.21.21`          | DNS only     |
   | CNAME | www  | `cname.vercel-dns.com` | DNS only     |

   Vercel's domain screen may show project-specific values. If it does, use those.
3. Keep both records set to **DNS only** (grey cloud) so Vercel can issue and renew the SSL certificate.

### Email on your domain

- **Receiving:** Cloudflare's free **Email Routing** can forward `hello@carlsdaleescalo.com` to your personal inbox.
- **Sending:** to send notifications from `noreply@carlsdaleescalo.com`, verify the domain in Resend. This means adding the SPF and DKIM records Resend gives you in Cloudflare DNS.

## Scripts

| Command         | What it does             |
|-----------------|--------------------------|
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm run start` | Serve the production build |
| `npm run lint`  | ESLint                   |
| `npm test`      | Run unit tests (Vitest)  |
