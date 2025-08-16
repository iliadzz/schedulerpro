// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { roleToPerms } = require('./rbac');

admin.initializeApp();

exports.setUserRole = functions.https.onCall(async (data, context) => {
    // 1. Check if the user making the request is a General Manager
    if (context.auth?.token?.is_gm !== true) {
        throw new functions.https.HttpsError('permission-denied', 'You must be a General Manager to manage roles.');
    }

    const { email, role } = data;
    if (!email || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "email" and "role" arguments.');
    }

    try {
        // 2. Get the user's account by their email
        const user = await admin.auth().getUserByEmail(email);

        // 3. Get the permissions for the requested role
        const perms = roleToPerms[role] || {};
        if (Object.keys(perms).length === 0) {
            throw new functions.https.HttpsError('not-found', `The role "${role}" does not exist.`);
        }

        // 4. Set the custom claims on the user's token
        await admin.auth().setCustomUserClaims(user.uid, { role, ...perms });

        return {
            status: 'success',
            message: `Successfully set ${email} to the role of ${role}.`
        };
    } catch (error) {
        console.error("Error setting user role:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while setting the user role.');
    }
});