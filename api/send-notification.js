// This runs as a free Vercel Serverless Function — NOT a Firebase Cloud Function.
// It costs $0 and needs no Firebase billing plan, because sending FCM messages
// via the Admin SDK is always free; only *Cloud Functions deployment* needs Blaze.
//
// index.html calls this endpoint right after an admin posts an announcement,
// assignment, or sets a holiday/GT day.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const CLASS_CODE = 'CSE-B-2026'; // must match `classCode` in index.html

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { title, body, secret } = req.body || {};

  // Simple shared-secret check. Not a real auth boundary (same trade-off as
  // the app's existing admin-key model) — just stops random passers-by from
  // hitting this endpoint. Real protection would verify a Firebase ID token.
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!title || !body) {
    res.status(400).json({ error: 'Missing title or body' });
    return;
  }

  try {
    const db = admin.firestore();
    const membersSnap = await db.collection('classes').doc(CLASS_CODE).collection('members').get();

    const tokens = [];
    membersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.fcmTokens) tokens.push(...Object.keys(data.fcmTokens));
    });

    if (!tokens.length) {
      res.status(200).json({ sent: 0, message: 'No device tokens registered yet.' });
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    // Clean up tokens that are no longer valid (uninstalled, cleared data, etc.)
    const deadTokens = [];
    response.responses.forEach((r, i) => {
      if (
        !r.success &&
        ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(r.error?.code)
      ) {
        deadTokens.push(tokens[i]);
      }
    });
    if (deadTokens.length) {
      for (const doc of membersSnap.docs) {
        const data = doc.data();
        if (!data.fcmTokens) continue;
        const toRemove = deadTokens.filter((t) => data.fcmTokens[t]);
        if (toRemove.length) {
          const update = {};
          toRemove.forEach((t) => (update[`fcmTokens.${t}`] = admin.firestore.FieldValue.delete()));
          await doc.ref.update(update);
        }
      }
    }

    res.status(200).json({ sent: response.successCount, failed: response.failureCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
