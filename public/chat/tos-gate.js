/* Avern Terms of Service redirect gate.
   Change this version whenever the TOS changes so everyone must accept again. */
const AVERN_TOS_VERSION = '2026-10-05';

const originalAvernBoot = bootAuthenticatedAccount;

bootAuthenticatedAccount = async function(user) {
  try {
    const usernameSnap = await db.ref('uid_usernames/' + user.uid).once('value');
    const usernameLower = String(usernameSnap.val() || '').toLowerCase();

    // New accounts still need the normal chat setup to create a username first.
    if (!usernameLower) {
      return originalAvernBoot(user);
    }

    const profileSnap = await db.ref('chat_profiles/' + usernameLower).once('value');
    const profile = profileSnap.val() || {};

    if (String(profile.tosAcceptedVersion || '') !== AVERN_TOS_VERSION) {
      const returnPath = encodeURIComponent('/chat/');
      window.location.replace('/tos/index.html?return=' + returnPath);
      return;
    }

    return originalAvernBoot(user);
  } catch (error) {
    console.error('TOS check failed:', error);
    document.getElementById('auth-screen').hidden = false;
    authMsg('Could not verify the Terms of Service status. Check your connection and try again.');
  }
};
