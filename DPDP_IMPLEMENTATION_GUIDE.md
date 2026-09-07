# CampusHub — DPDP Implementation Guide

This maps every file in this bundle to what it does, and gives you the exact
steps to wire it into your real repo.

**Legal status check (as of today):** most of the DPDP Act's operational duties
(consent notice/mechanics, the 30/90-day grievance clock, erasure/access
rights) are not yet in force — they commence in the DPDP Rules' Phase 3
(May 2027). Doing this now is proactive risk-reduction, not a hard deadline.
None of this is legal advice — have an actual lawyer review the two legal
pages before you rely on them.

---

## What's in this bundle

```
legal/
  privacy-policy.md / .html      ← Part 1.1 — edit the [PLACEHOLDERS], then host the .html
  terms-of-service.md / .html    ← Part 1.2 — same
api/
  _firebaseAdmin.js              ← shared Admin SDK bootstrapper, not an endpoint itself
  consent.js                     ← Part 3.2 — POST /api/consent
  delete-account.js              ← Part 4.1 — POST /api/delete-account
  export-data.js                 ← Part 4.2 — GET /api/export-data
consent-banner-snippet.html      ← Part 2 — paste into your main HTML file
```

## The data model this was built against

Your app's real Firestore/RTDB shape (confirmed from your actual code, not assumed):

- `classes/{classCode}/members/{uid}` — name, email, photoURL, role, isAdmin, vibeTag, chatColor, accessStatus, fcmTokens
- `classes/{classCode}/chat/{autoId}` — text, name, uid, role, vibeTag, color, ts
- `classes/{classCode}/discussions/{id}` (+ `/messages` subcollection) — title, description, status, requestedBy, requestedByName, ts
- `classes/{classCode}/polls/{id}/votes/{uid}`
- `classes/{classCode}/assignments|announcements|resources` — admin-authored, not personal data
- `users/{uid}/attendance_logs/{docId}` — private per-user attendance marks
- Realtime DB: `presence/{classCode}/{uid}`
- Firebase Auth: uid, email, displayName, photoURL (Google sign-in)

If you add new collections that store personal data later (e.g. a new
feature that saves something per-user), remember to add them to
`delete-account.js` and `export-data.js` too — the code in this bundle only
knows about what exists in your app today.

---

## Step 1 — Fill in the legal pages

1. Open `legal/privacy-policy.md` and `legal/terms-of-service.md`.
2. Replace every `[PLACEHOLDER]`: your name/CR name as Grievance Officer, a
   real contact email, `[YOUR CITY]` for jurisdiction, and the `[DATE]` fields.
3. The `.html` versions are auto-generated from the `.md` — if you edit the
   `.md`, regenerate the `.html` (or just hand-edit both, they're small).
4. Deploy `privacy-policy.html` and `terms-of-service.html` to the root of
   your Vercel static output (same place `campushub.html`/`index.html` lives),
   so `/privacy-policy.html` and `/terms-of-service.html` resolve.

## Step 2 — Deploy the backend endpoints

1. Copy `api/_firebaseAdmin.js`, `api/consent.js`, `api/delete-account.js`,
   and `api/export-data.js` into your project's `/api` folder (same place
   your existing `send-notification` function lives).
2. Generate a service account key: **Firebase Console → Project Settings →
   Service Accounts → Generate new private key**. This downloads a JSON file.
3. In your Vercel project settings, add these Environment Variables:
   - `FIREBASE_PROJECT_ID` → `ietcse-bb0c9`
   - `FIREBASE_CLIENT_EMAIL` → the `client_email` field from the JSON
   - `FIREBASE_PRIVATE_KEY` → the `private_key` field from the JSON, pasted as-is (Vercel handles the `\n` sequences fine when pasted directly into their env var UI — just don't manually strip them)
   - `FIREBASE_DATABASE_URL` → your Realtime Database URL, from Firebase Console → Realtime Database (top of the page)
   - `CLASS_CODE` → `CSE-B-2026` (or whatever your current `classCode` constant is)
4. Redeploy. Your three endpoints are now live at `/api/consent`,
   `/api/delete-account`, `/api/export-data`.

## Step 3 — Wire in the consent banner

Follow the numbered instructions at the top of `consent-banner-snippet.html`
— it tells you exactly which block goes where (`<style>`, the modal `<div>`,
the `<script>` contents, and the one line to add inside `boot()`).

## Step 4 — Add Export/Delete buttons to Settings

`consent-banner-snippet.html` includes `exportMyData()` and
`deleteMyAccount()` functions plus example buttons at the bottom — drop
those into wherever your app currently renders the Settings/Profile tab.

## Step 5 — (Recommended) Lock down the new collection with Firestore rules

`consent_logs` should only ever be written by your server (via the Admin
SDK, which bypasses rules entirely) — client writes to it should be blocked.
I don't have your current `firestore.rules` file, so I can't safely merge
this in for you, but add something like this to it:

```
match /consent_logs/{docId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
  allow write: if false; // writes only happen server-side via the Admin SDK
}
```

## Step 6 — Test before rolling out to your batch

- [ ] New sign-in → consent modal appears → "I Agree" → check Firestore for a new `consent_logs/{uid}_v1.0-...` doc with a real IP and timestamp
- [ ] Existing user, unchanged `DPDP_POLICY_VERSION` → no modal (already consented)
- [ ] Bump `DPDP_POLICY_VERSION` in the snippet → existing users see the modal again on next load
- [ ] "Decline & Sign Out" actually signs out
- [ ] "Export My Data" downloads a JSON with your own profile, attendance, chat, discussions, poll votes
- [ ] "Delete My Account" (test with a throwaway/test account first!) removes the member doc, anonymises chat/discussion messages, deletes poll votes and attendance logs, and the account can no longer sign in
