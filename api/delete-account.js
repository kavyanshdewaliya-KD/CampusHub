// api/delete-account.js
//
// POST /api/delete-account
// Header: Authorization: Bearer <Firebase ID token>
//
// Section 12 — Right to Erasure. Walks every place CampusHub is known to store
// personal data (see DPDP_IMPLEMENTATION_GUIDE.md for the full data map) and
// either deletes it outright or anonymises it, then deletes the Auth account.
//
// Design choice: messages posted in SHARED spaces (class chat, discussion
// threads) are ANONYMISED rather than deleted outright, so other members'
// conversations aren't torn apart by holes. Purely personal data (attendance
// logs, poll votes, the member/profile doc, presence) is deleted outright.
//
// consent_logs are deliberately NOT touched — see the note at the bottom.

const { getAdmin } = require('./_firebaseAdmin');

const CLASS_CODE = process.env.CLASS_CODE || 'CSE-B-2026';

function anonymiseMessages(snap, ops) {
  snap.docs.forEach((d) => {
    ops.push(
      d.ref.update({
        uid: null,
        name: 'Deleted User',
        text: '[message removed — user deleted their account]',
        color: null,
        vibeTag: '',
      })
    );
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
  const ops = [];

  try {
    // 1) Personal attendance logs — fully personal, delete outright.
    const attSnap = await db.collection('users').doc(uid).collection('attendance_logs').get();
    attSnap.docs.forEach((d) => ops.push(d.ref.delete()));

    // 2) Member/profile doc for this class.
    ops.push(db.collection('classes').doc(CLASS_CODE).collection('members').doc(uid).delete());

    // 3) Class-wide + private chat messages this person sent — anonymise.
    const chatSnap = await db
      .collection('classes').doc(CLASS_CODE).collection('chat')
      .where('uid', '==', uid).get();
    anonymiseMessages(chatSnap, ops);

    // 4) Discussion topics this person raised, and their messages in EVERY
    //    discussion thread (including ones raised by other people).
    const allDiscussions = await db.collection('classes').doc(CLASS_CODE).collection('discussions').get();
    for (const disc of allDiscussions.docs) {
      if (disc.data().requestedBy === uid) {
        ops.push(disc.ref.update({ requestedBy: null, requestedByName: 'Deleted User' }));
      }
      const theirMsgs = await disc.ref.collection('messages').where('uid', '==', uid).get();
      anonymiseMessages(theirMsgs, ops);
    }

    // 5) Poll votes — personal choices, delete outright rather than anonymise.
    const pollsSnap = await db.collection('classes').doc(CLASS_CODE).collection('polls').get();
    for (const poll of pollsSnap.docs) {
      const voteRef = poll.ref.collection('votes').doc(uid);
      const voteDoc = await voteRef.get();
      if (voteDoc.exists) ops.push(voteRef.delete());
    }

    await Promise.all(ops);

    // 6) Realtime Database presence node (best-effort — skip if RTDB isn't configured).
    if (rtdb) {
      try {
        await rtdb.ref(`presence/${CLASS_CODE}/${uid}`).remove();
      } catch (e) {
        console.warn('RTDB presence cleanup skipped:', e.message);
      }
    }

    // 7) Finally, delete the Firebase Auth account itself.
    await admin.auth().deleteUser(uid);

    // NOTE: consent_logs are deliberately kept. Section 6's burden of proof
    // means you need to be able to show valid consent existed WHILE you
    // processed this person's data — even after they've left. If you want a
    // harder erasure guarantee later, run a scheduled job that strips
    // `user_email` from consent_logs after your legal retention window,
    // instead of deleting the row outright.

    return res.status(200).json({ ok: true, message: 'Account and associated personal data deleted.' });
  } catch (e) {
    console.error('account deletion failed', e);
    return res.status(500).json({
      error: 'Deletion failed partway through — check server logs and retry.',
      detail: e.message,
    });
  }
};
