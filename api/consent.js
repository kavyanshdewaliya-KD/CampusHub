// api/consent.js
//
// POST /api/consent
// Body: { policyVersion: string, consentGiven: boolean }
// Header: Authorization: Bearer <Firebase ID token>
//
// Writes one row to Firestore collection `consent_logs`. This is the record
// that satisfies DPDP Act Section 6(1)'s burden-of-proof requirement — the
// Data Fiduciary (you) must be able to show consent was actually given.
//
// Deliberately server-side (not written directly from the client) so the
// IP address and uid are trustworthy, not just whatever the client claims.

const { db, requireAuth } = require('./_firebaseAdmin');

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

  const { policyVersion, consentGiven } = req.body || {};
  if (!policyVersion || typeof consentGiven !== 'boolean') {
    return res.status(400).json({ error: 'policyVersion (string) and consentGiven (boolean) are required' });
  }

  // Vercel populates x-forwarded-for with the real client IP (first entry in the list).
  const forwardedFor = req.headers['x-forwarded-for'] || '';
  const ipAddress = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

  try {
    await db.collection('consent_logs').add({
      user_id: uid,
      policy_version: policyVersion,
      consent_given: consentGiven,
      ip_address: ipAddress,
      user_agent: req.headers['user-agent'] || null,
      timestamp: new Date(), // Firestore stores this as a Timestamp
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('consent log write failed:', e);
    return res.status(500).json({ error: 'Failed to log consent' });
  }
};
