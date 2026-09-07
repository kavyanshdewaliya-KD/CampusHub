// api/export-data.js
//
// GET /api/export-data
// Header: Authorization: Bearer <Firebase ID token>
//
// DPDP Act Section 11 — Right to Access. Returns everything this app
// holds that is tied to the requesting user, as one JSON document.
//
// Same coverage/limitations as delete-account.js — see the comments
// there (single class instance hardcoded below; assignments/resources
// aren't attributable per-user because they don't store a uid).

const { db, auth, requireAuth } = require('./_firebaseAdmin');

const CLASS_CODE = 'CSE-B-2026'; // matches `classCode` in index.html

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let uid;
  try {
    uid = await requireAuth(req);
  } catch (e) {
    return res.status(e.statusCode || 401).json({ error: e.message });
  }

  const classRef = db.collection('classes').doc(CLASS_CODE);
  const out = {
    generated_at: new Date().toISOString(),
    note: "This export covers all personal data CampusHub holds for you. Class-wide content (chat, discussions) only includes messages YOU sent, not other members' messages.",
  };

  // Auth profile
  try {
    const u = await auth.getUser(uid);
    out.account = {
      uid: u.uid,
      email: u.email || null,
      displayName: u.displayName || null,
      photoURL: u.photoURL || null,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
    };
  } catch (e) {
    out.account = { error: 'Could not load auth profile: ' + e.message };
  }

  // Class membership / profile doc
  try {
    const memberDoc = await classRef.collection('members').doc(uid).get();
    out.class_profile = memberDoc.exists ? memberDoc.data() : null;
  } catch (e) { out.class_profile = { error: e.message }; }

  // Private data: attendance + calendar plans
  try {
    const attSnap = await db.collection('users').doc(uid).collection('attendance_logs').get();
    out.attendance_logs = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { out.attendance_logs = { error: e.message }; }

  try {
    const planSnap = await db.collection('users').doc(uid).collection('calendar_plans').get();
    out.calendar_plans = planSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { out.calendar_plans = { error: e.message }; }

  // Class-wide chat messages authored by this user
  try {
    const chatSnap = await classRef.collection('chat').where('uid', '==', uid).get();
    out.class_chat_messages = chatSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { out.class_chat_messages = { error: e.message }; }

  // Private DM + discussion-thread messages (same collectionGroup trick as delete-account.js)
  try {
    const msgSnap = await db.collectionGroup('messages').where('uid', '==', uid).get();
    out.private_and_discussion_messages = msgSnap.docs.map(d => ({ path: d.ref.path, ...d.data() }));
  } catch (e) { out.private_and_discussion_messages = { error: e.message }; }

  // Poll votes
  try {
    const pollsSnap = await classRef.collection('polls').get();
    const votes = [];
    for (const p of pollsSnap.docs) {
      const voteDoc = await p.ref.collection('votes').doc(uid).get();
      if (voteDoc.exists) votes.push({ pollId: p.id, pollQuestion: p.data().question || null, ...voteDoc.data() });
    }
    out.poll_votes = votes;
  } catch (e) { out.poll_votes = { error: e.message }; }

  // Discussion topics raised by this user
  try {
    const raisedSnap = await classRef.collection('discussions').where('requestedBy', '==', uid).get();
    out.discussion_topics_raised = raisedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { out.discussion_topics_raised = { error: e.message }; }

  // Announcements posted by this user (CR/admin only)
  try {
    const annSnap = await classRef.collection('announcements').where('byUid', '==', uid).get();
    out.announcements_posted = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { out.announcements_posted = { error: e.message }; }

  // Consent log history
  try {
    const consentSnap = await db.collection('consent_logs').where('user_id', '==', uid).get();
    out.consent_history = consentSnap.docs.map(d => d.data());
  } catch (e) { out.consent_history = { error: e.message }; }

  res.setHeader('Content-Disposition', 'attachment; filename="campushub-my-data.json"');
  return res.status(200).json(out);
};
