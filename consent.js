// api/consent.js
//
// POST /api/consent
// Body: { policyVersion: string, consentGiven: boolean }
// Header: Authorization: Bearer <Firebase ID token>
//
// Writes a server-authoritative consent record: who (verified via ID token,
// never trusted from the request body), what they agreed to, and a
// server-captured IP + user agent + timestamp — this is what satisfies the
// Section 6 burden-of-proof requirement (the business must be able to PROVE
// consent was given, not just claim it).

const { getAdmin } = require('./_firebaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { admin, db } = getAdmin();

  // 1) Authenticate the caller server-side — never trust a uid sent by the client.
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

  // 2) Validate the payload — this only carries "what", never "who" or "when".
  const { policyVersion, consentGiven } = req.body || {};
  if (!policyVersion || typeof policyVersion !== 'string' || typeof consentGiven !== 'boolean') {
    return res.status(400).json({ error: 'policyVersion (string) and consentGiven (boolean) are required' });
  }

  // 3) Capture IP + user agent server-side — the client cannot spoof these.
  const forwardedFor = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipAddress = forwardedFor || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const record = {
    user_id: decoded.uid,
    user_email: decoded.email || null,
    policy_version: policyVersion,
    consent_given: consentGiven,
    ip_address: ipAddress,
    user_agent: userAgent,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    // One doc per (user, policy_version): re-agreeing to the SAME version just
    // refreshes the timestamp/IP. A NEW policy_version always gets its own doc,
    // so your full consent history across policy changes is preserved forever.
    const docId = `${decoded.uid}_${policyVersion}`;
    await db.collection('consent_logs').doc(docId).set(record, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('consent log write failed', e);
    return res.status(500).json({ error: 'Could not save consent record' });
  }
};
