// api/delete-account.js
//
// POST /api/delete-account
// Header: Authorization: Bearer <Firebase ID token>
//
// DPDP Act Section 12 — Right to Erasure. Deletes everything that is
// exclusively personal to this user, and anonymizes their identifying
// fields on shared/class-wide content (chat, discussions, announcements)
// rather than deleting shared records outright, since other members'
// conversations depend on that shared context still existing.
//
// IMPORTANT — known limitations to be aware of / extend later:
//  1. This app currently runs as a single class instance (classCode is
//     fixed below). If you ever go multi-tenant, this needs to look up
//     the user's actual class(es) instead of hardcoding one.
//  2. `assignments` and `resources` docs only store the poster's
//     display name (`byName`), not their uid, so they can't be reliably
//     matched and anonymized here. If you want that covered, add a
//     `byUid` field when those are created, then extend this function.

const { db, auth, requireAuth } = require('./_firebaseAdmin');

const CLASS_CODE = 'CSE-B-2026'; // matches `classCode` in index.html

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let uid;
  try {
    uid = await requireAuth(req);
  } catch (e) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }

  const errors = [];
  const classRef = db.collection('classes').doc(CLASS_CODE);

  // 1. Fully private data: users/{uid}/attendance_logs/*, users/{uid}/calendar_plans/*
  try {
    await db.recursiveDelete(db.collection('users').doc(uid));
  } catch (e) { errors.push('users/' + uid + ': ' + e.message); }

  // 2. Class membership / profile doc (also removes stored FCM push tokens, which live on this doc)
  try {
    await classRef.collection('members').doc(uid).delete();
  } catch (e) { errors.push('members: ' + e.message); }

  // 3. Class-wide chat messages authored by this user
  try {
    const chatSnap = await classRef.collection('chat').where('uid', '==', uid).get();
    await Promise.all(chatSnap.docs.map(d => d.ref.delete()));
  } catch (e) { errors.push('chat: ' + e.message); }

  // 4. Private DM messages AND discussion-thread messages authored by this user —
  //    both live in subcollections literally named "messages", so one
  //    collectionGroup query catches both private_chats/*/messages and
  //    classes/*/discussions/*/messages in a single pass.
  try {
    const msgSnap = await db.collectionGroup('messages').where('uid', '==', uid).get();
    await Promise.all(msgSnap.docs.map(d => d.ref.delete()));
  } catch (e) { errors.push('messages (DM/discussions): ' + e.message); }

  // 5. Poll votes: classes/{code}/polls/{pollId}/votes/{uid} — doc ID is the uid itself
  try {
    const pollsSnap = await classRef.collection('polls').get();
    await Promise.all(pollsSnap.docs.map(p => p.ref.collection('votes').doc(uid).delete().catch(() => {})));
  } catch (e) { errors.push('poll votes: ' + e.message); }

  // 6. Discussion topics this user raised — anonymize rather than delete,
  //    since others may still be actively discussing the topic.
  try {
    const raisedSnap = await classRef.collection('discussions').where('requestedBy', '==', uid).get();
    await Promise.all(raisedSnap.docs.map(d => d.ref.update({ requestedBy: null, requestedByName: 'Deleted User' })));
  } catch (e) { errors.push('discussions (raised): ' + e.message); }

  // 7. Announcements this user posted (CR/admin) — anonymize
  try {
    const annSnap = await classRef.collection('announcements').where('byUid', '==', uid).get();
    await Promise.all(annSnap.docs.map(d => d.ref.update({ byUid: null, byName: 'Deleted User' })));
  } catch (e) { errors.push('announcements: ' + e.message); }

  // 8. Finally, delete the Firebase Auth account itself (also invalidates all sessions/tokens)
  try {
    await auth.deleteUser(uid);
  } catch (e) { errors.push('auth user: ' + e.message); }

  if (errors.length) {
    // Partial failure — log it server-side for manual follow-up, but still tell the
    // client it mostly succeeded so they aren't stuck. Never silently swallow this.
    console.error('delete-account partial failure for uid', uid, errors);
    return res.status(207).json({ ok: true, warnings: errors });
  }
  return res.status(200).json({ ok: true });
};
