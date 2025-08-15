// setAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

(async () => {
  try {
    const email = 'feedback.luckypaisa@gmail.com';
    const user = await admin.auth().getUserByEmail(email);

    // Give this account the admin claim forever
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log(`✅ Admin role granted to: ${email}`);
    process.exit();
  } catch (error) {
    console.error('❌ Error setting admin claim:', error);
    process.exit(1);
  }
})();
