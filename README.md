# CampusHub — Firebase build (Phase 1)

This is the **real, always-online** version, backed by your Firebase project (`ietcse-bb0c9`). It has real Google Sign-In, shared class data in Firestore, live "who's online" via Realtime Database, and push notification wiring.

## What's in this phase
Working: Google login, Timetable (view + admin JSON editor), Announcements (admin post, everyone sees), Class chat, Members with live presence, notification permission + FCM token registration.

**Not ported yet** (from the prototype you tested in chat): Attendance tracking, Syllabus/Tests/Assignments-with-file-links, Calendar leave-planning, Private DMs, theme switcher, subject-colored timetable. These all work the same way structurally (a Firestore collection under `classes/{code}/...`) — tell me to continue and I'll port them next, now that the core (auth + data + presence) is confirmed working for you.

## 1. Before you deploy — three things to do in the Firebase console

**A. Get your VAPID key** (for push notifications to work)
Project settings → Cloud Messaging → "Web Push certificates" → Generate key pair → copy the key → paste it into `VAPID_KEY` in `index.html` (search for `PASTE_YOUR_VAPID_KEY_HERE`) **and** you don't need to touch the service worker for this part.

**B. Turn on Google Sign-In**
Authentication → Sign-in method → enable Google.

**C. Create Firestore + Realtime Database**
Firestore Database → Create database → start in **test mode** for now (see security rules below to lock it down before real use).
Realtime Database → Create database → start in **test mode** for now too.

## 2. Security rules (important — test mode is wide open)

Test mode allows anyone to read/write anything for 30 days, then locks everyone out. Replace with this before real use (Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /classes/{classCode} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // tighten below once you add admin claims

      match /{subcollection}/{docId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
    }
  }
}
```

⚠️ **Honest caveat**: this still lets any signed-in user write anywhere (e.g. edit the timetable), because "admin" here is just a `isAdmin: true` field on their own member doc — a client-side check, not a server-enforced one. A student could theoretically edit their own member doc to say `isAdmin: true` via the browser console. For a real class tool where that matters, the fix is **Firebase custom claims** set by a Cloud Function when someone enters the correct admin passcode — happy to build that next if you want it hardened.

Realtime Database rules (Realtime Database → Rules):
```json
{
  "rules": {
    "presence": {
      "$classCode": {
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

## 3. Actually sending push notifications (the part that needs a server)

Getting a device token (done, in `index.html`) is only half of FCM. To make a new announcement actually **push** to everyone's phone, something server-side has to call the FCM Send API when a new announcement document is created. That's a **Cloud Function** — requires the Blaze (pay-as-you-go) plan, but Cloud Functions has a generous free quota (2M invocations/month) so a class project won't be charged in practice.

If you want this, run `firebase init functions` in this folder and use:

```js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();

exports.notifyOnAnnouncement = onDocumentCreated("classes/{classCode}/announcements/{id}", async (event) => {
  const { classCode } = event.params;
  const data = event.data.data();
  const membersSnap = await getFirestore().collection(`classes/${classCode}/members`).get();
  const tokens = membersSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: `📢 ${data.byName}`, body: data.text },
  });
});
```

Deploy with `firebase deploy --only functions`.

## 4. Deploy to Vercel or GitHub Pages

This is a static site (no build step), so:
- **Vercel**: push this folder to a GitHub repo, import it in Vercel, framework preset "Other," no build command, output directory `/`. Done.
- **GitHub Pages**: Settings → Pages → deploy from this folder's branch.

`firebase-messaging-sw.js` and `manifest.json` **must** be served from the site root for push/PWA to work — don't move them into a subfolder.

## 5. Icons

Add your own `icon-192.png` and `icon-512.png` to this folder (referenced in `manifest.json`) — any square PNG works, these just aren't included here.
