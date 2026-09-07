// api/_firebaseAdmin.js
//
// Shared Firebase Admin SDK bootstrapper — every /api function that needs
// server-side Firestore/Auth/RTDB access should `require('./_firebaseAdmin')`
// instead of calling admin.initializeApp() itself, so we never double-init
// on warm serverless invocations.
//
// Requires these environment variables to be set in your Vercel project
// (Settings → Environment Variables):
//   FIREBASE_PROJECT_ID     e.g. "ietcse-bb0c9"
//   FIREBASE_CLIENT_EMAIL   from your service account JSON
//   FIREBASE_PRIVATE_KEY    from your service account JSON (see note below)
//   FIREBASE_DATABASE_URL   your Realtime Database URL (only needed for presence cleanup)
//   CLASS_CODE              e.g. "CSE-B-2026" (matches classCode in the frontend)
//
// Get the service account JSON from:
//   Firebase Console → Project Settings → Service Accounts → Generate new private key
//
// NOTE on FIREBASE_PRIVATE_KEY: Vercel env vars can't store real newline
// characters cleanly through the dashboard UI, so paste the key with literal
// "\n" sequences and we unescape them below.

const admin = require('firebase-admin');

function getAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return {
    admin,
    db: admin.firestore(),
    rtdb: process.env.FIREBASE_DATABASE_URL ? admin.database() : null,
  };
}

module.exports = { getAdmin };
