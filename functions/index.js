
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

// Callable: setRole(uid, role). Only OWNER_UID may call.
export const setRole = functions.https.onCall(async (data, context) => {
  const ownerUid = process.env.OWNER_UID || (await admin.firestore().doc('config/app').get()).data()?.OWNER_UID;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated','Auth required');
  if (context.auth.uid !== ownerUid) throw new functions.https.HttpsError('permission-denied','Only owner');
  const { uid, role } = data || {};
  const allowed = ['owner','admin','mod','player'];
  if (!uid || !allowed.includes(role)) throw new functions.https.HttpsError('invalid-argument','Bad role');
  await admin.auth().setCustomUserClaims(uid, { role });
  // also store for reference
  await admin.firestore().collection('roles').doc(uid).set({ role, updated: admin.firestore.FieldValue.serverTimestamp() }, {merge:true});
  return { ok: true };
});
