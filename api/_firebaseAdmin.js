// api/_firebaseAdmin.js
//
// Shared Firebase Admin SDK bootstrap for all serverless functions in /api.
// If you already have a firebase-admin init file elsewhere in this project
// (e.g. the one used by send-notification.js), just import that one instead
// of this file in consent.js / delete-account.js / export-data.js — do NOT
// initialize the admin app twice.
//
// Required Vercel environment variables (Project Settings → Environment Variables):
//   FIREBASE_PROJECT_ID    e.g. ietcse-bb0c9
//   FIREBASE_CLIENT_EMAIL  from your service account JSON
//   FIREBASE_PRIVATE_KEY   from your service account JSON (keep the \n escapes as-is when pasting into Vercel)

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores env vars as plain strings — literal "\n" needs to become a real newline.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  });
}

const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();

// Verifies the Firebase ID token sent by the client and returns the trusted uid.
// NEVER trust a uid sent directly in the request body/query — always derive it from the token.
async function requireAuth(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error('Missing Authorization: Bearer <idToken> header');
    err.statusCode = 401;
    throw err;
  }
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    return decoded.uid;
  } catch (e) {
    const err = new Error('Invalid or expired ID token');
    err.statusCode = 401;
    throw err;
  }
}

module.exports = { admin, db, rtdb, auth, requireAuth };
