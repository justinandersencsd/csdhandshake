# Phase 2 Bundle — Auth & Invitations

## How to install

1. **Unzip this archive** at the root of your `csdhandshake` repo. Every file
   is already pathed correctly under `src/` — they'll slot into existing
   folders and create new ones where needed.

2. **Update `.env.local`** — you need the `APP_URL` to point at your
   Codespace so invite email links work. Your Codespace URL looks like:

   `https://YOUR-CODESPACE-NAME-3000.app.github.dev`

   Get yours from the Codespaces **Ports** tab: port 3000 → "Forwarded
   address" column → copy that URL (remove trailing slash).

   Set in `.env.local`:
   ```
   APP_URL=https://YOUR-CODESPACE-NAME-3000.app.github.dev
   ```

3. **Supabase dashboard → Authentication → URL Configuration:**
   - **Site URL**: paste your Codespace URL (same as APP_URL above)
   - **Redirect URLs**: add `https://YOUR-CODESPACE-NAME-3000.app.github.dev/**`
     (the `**` wildcard covers all subpaths)

4. **Restart the dev server** (`Ctrl+C` then `npm run dev`).

## What this bundle adds

### New pages
- `/admin/invite` — teachers and admins can invite students/partners
- `/invite/[token]` — invitees land here to set their password
- `/onboarding/coc` — 5-section code of conduct (partners)
- `/onboarding/aup` — shorter acceptable use agreement (students)
- `/forgot-password` — request a reset link
- `/reset-password` — set a new password
- `/auth/callback` — handles the Supabase reset code exchange

### New helpers
- `src/lib/supabase/admin.ts` — secret-key client for server-side privileged ops
- `src/lib/email/send-invitation.ts` — Resend-powered invitation email

### Updated files
- `src/app/page.tsx` — adds an "Invite someone" button and COC/AUP gating

## How to test the full flow

1. Log in as your district_admin account
2. Click "Invite someone"
3. Fill in the form — use your OWN email as the invitee for testing
   (Resend can only send to verified addresses unless you've verified a domain)
4. Set role: `partner` to test the 5-section COC, or `student` for AUP
5. Check your inbox. Click the invitation link.
6. Set a password. You'll be logged in and routed to the onboarding page for your role.
7. Accept the agreement. You're now at the home page as the new role.
8. Log out, log back in as your admin to invite more people.

## Notes

- Invite emails send from the `RESEND_FROM_EMAIL` address you set in `.env.local`.
- Accepting a COC or AUP records the IP address. In Codespaces you'll see an
  internal IP; in production behind Vercel you'll see the real client IP.
- The 5 COC sections and AUP text are placeholders. Replace with your final
  legal-reviewed copy before piloting.
- Students use the same `coc_accepted_at` DB fields as partners (the schema
  doesn't have separate AUP fields). One timestamp means "signed off on the
  agreement for their role."

## Commit message

```
git add .
git commit -m "Phase 2: Invite flow, COC, AUP, and password reset"
git push
```
