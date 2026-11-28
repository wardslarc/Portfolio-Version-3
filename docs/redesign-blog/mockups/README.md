# Mockups (reference only)

These are the sources of the approved design canvas
(https://claude.ai/artifact/9cESW7sS12T127KmdZXvTS, approved by Carls 2026-11-28).

- `BlogList.dc.html` → `/blog` (and `/blog/tag/[tag]`)
- `Post.dc.html` → `/blog/[slug]`
- `Login.dc.html`, `Verify.dc.html`, `Backup.dc.html` → the three steps of `/admin/login`
- `Invite.dc.html` → `/admin/invite/[token]`

**They don't run on their own** (they need the canvas runtime). Read them for exact CSS values, layout and motion
timing. `{{name}}` is a template hole; `<sc-if>`/`<sc-for>` are the canvas's if/loop tags; `@container page (…)` stands
for the real site's media queries (`SPEC.md` §6). The `<script>` blocks are mockup behavior only: never copy them.

Bracketed text such as `[Cover image]`, `[Post title]` or `[sample codes …]` is a placeholder for real data. Copy that
the real site already has (error messages, labels, button text) wins over mockup copy: see `SPEC.md` §8.
