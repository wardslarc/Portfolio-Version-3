# Carls Dale Escalo: Portfolio v3

Personal portfolio for [carlsdaleescalo.com](https://www.carlsdaleescalo.com). It's a single Next.js app: the page and the contact API ship together as one Vercel deployment.

## Stack

- **Next.js 16** (App Router, Turbopack) with React 19 and TypeScript
- **Node.js** route handlers for contact, visitor chess, blog views, RSS, and Blob uploads
- **MongoDB Atlas** to store contact messages, visitor chess games, admin state, and blog posts/media
- **Vercel Blob** (optional) for public blog image storage via direct browser client uploads
- **Resend** (optional) to email new messages and admin login codes
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

- **Receiving:** Cloudflare's free **Email Routing** can forward `mail@carlsdaleescalo.com` to your personal inbox.
- **Sending:** to send notifications from `noreply@carlsdaleescalo.com`, verify the domain in Resend. This means adding the SPF and DKIM records Resend gives you in Cloudflare DNS.

## Admin area

The `/admin` area is a guarded control panel for managing contact messages, writing and publishing blog posts, managing uploaded media, moderating visitor chess, and managing admin access.

- **Authentication:** Email + password followed by a 6-digit one-time code sent via Resend (or a one-time backup code), with an optional 30-day trusted-device cookie.
- **Roles:** `owner` (full access including team management), `admin` (messages, blog writing/publishing, media library, chess moderation, activity log), and `viewer` (read-only).
- **Bootstrap the first Owner:**

```bash
# Set ADMIN_OWNER_EMAIL, ADMIN_SECRET, and MONGODB_URI in .env.local
npm run admin:setup
```

Open the printed one-time `/admin/invite/<token>` link to set your name and password, then sign in at `/admin/login`.

## Blog & Vercel Blob setup

Public posts live at `/blog` and `/blog/[slug]`, with an RSS 2.0 feed at `/blog/rss.xml`, dynamic per-post Open Graph images, sitemap entries, and a "Writing" section on the homepage when live posts exist.

1. In the Vercel dashboard, open **Storage → Create Database → Blob** with **Public** access and connect it to this project for all environments (sets `BLOB_READ_WRITE_TOKEN`).
2. Pull the environment variable locally with `vercel env pull .env.local`.
3. Without `BLOB_READ_WRITE_TOKEN`, the app still builds and runs cleanly; the blog editor shows `"Image uploads aren't configured."` and disables upload controls. Without `MONGODB_URI`, `/blog` renders the empty state.

## Vercel Analytics

Vercel Web Analytics and Speed Insights are enabled on the public site (`src/components/Telemetry.tsx`). Both use a `beforeSend` filter (`src/lib/analytics.ts`) to drop any `/admin` URLs, and `/admin` is disallowed in `src/app/robots.ts`.

## Scripts

| Command               | What it does                               |
|-----------------------|--------------------------------------------|
| `npm run dev`         | Start the dev server                       |
| `npm run build`       | Production build                           |
| `npm run start`       | Serve the production build                 |
| `npm run lint`        | ESLint                                     |
| `npm test`            | Run unit tests (Vitest)                    |
| `npm run admin:setup` | Create the initial Owner invite in MongoDB |
