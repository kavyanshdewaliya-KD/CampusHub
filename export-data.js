// api/export-data.js
//
// GET /api/export-data
// Header: Authorization: Bearer <Firebase ID token>
//
// Section 11 — Right to Access. Gathers everything CampusHub has stored about
// the requesting user across every known collection and returns it as one
// downloadable JSON file.

const { getAdmin } = require('./_firebaseAdmin');

const CLASS_CODE = process.env.CLASS_CODE || 'CSE-B-2026';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { admin, db, rtdb } = getAdmin();

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization: Bearer <idToken>' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired ID token' });
  }
  const uid = decoded.uid;

  try {
    const authRecord = await admin.auth().getUser(uid);

    const memberDoc = await db.collection('classes').doc(CLASS_CODE).collection('members').doc(uid).get();

    const attSnap = await db.collection('users').doc(uid).collection('attendance_logs').get();
    const attendanceLogs = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const chatSnap = await db
      .collection('classes').doc(CLASS_CODE).collection('chat')
      .where('uid', '==', uid).get();
    const chatMessages = chatSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const discussionsRaised = [];
    const discussionMessages = [];
    const allDiscussions = await db.collection('classes').doc(CLASS_CODE).collection('discussions').get();
    for (const disc of allDiscussions.docs) {
      const dData = disc.data();
      if (dData.requestedBy === uid) discussionsRaised.push({ id: disc.id, ...dData });
      const theirMsgs = await disc.ref.collection('messages').where('uid', '==', uid).get();
      theirMsgs.docs.forEach((m) => discussionMessages.push({ discussionId: disc.id, id: m.id, ...m.data() }));
    }

    const pollVotes = [];
    const pollsSnap = await db.collection('classes').doc(CLASS_CODE).collection('polls').get();
    for (const poll of pollsSnap.docs) {
      const voteDoc = await poll.ref.collection('votes').doc(uid).get();
      if (voteDoc.exists) pollVotes.push({ pollId: poll.id, ...voteDoc.data() });
    }

    let presence = null;
    if (rtdb) {
      try {
        const snap = await rtdb.ref(`presence/${CLASS_CODE}/${uid}`).get();
        presence = snap.exists() ? snap.val() : null;
      } catch (e) {
        /* RTDB not reachable — skip, non-fatal */
      }
    }

    const consentSnap = await db.collection('consent_logs').where('user_id', '==', uid).get();
    const consentHistory = consentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: {
        uid: authRecord.uid,
        email: authRecord.email,
        displayName: authRecord.displayName,
        photoURL: authRecord.photoURL,
        createdAt: authRecord.metadata.creationTime,
        lastSignInAt: authRecord.metadata.lastSignInTime,
      },
      classMembership: memberDoc.exists ? { classCode: CLASS_CODE, ...memberDoc.data() } : null,
      attendanceLogs,
      chatMessages,
      discussionsRaised,
      discussionMessages,
      pollVotes,
      presence,
      consentHistory,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="campushub-my-data-${uid}.json"`);
    return res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (e) {
    console.error('data export failed', e);
    return res.status(500).json({ error: 'Export failed — check server logs.', detail: e.message });
  }
};
