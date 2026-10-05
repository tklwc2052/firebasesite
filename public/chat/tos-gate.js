/* Avern Terms of Service gate. Update this value whenever the TOS changes. */
const AVERN_TOS_VERSION = '2026-10-05';
let pendingTosAccount = null;

function buildTosGate() {
  if (document.getElementById('tos-gate')) return;
  const style = document.createElement('style');
  style.textContent = `
#tos-gate{position:fixed;inset:0;z-index:210000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,6,8,.94);backdrop-filter:blur(6px)}
#tos-gate[hidden]{display:none!important}.tos-gate-card{width:min(680px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#1e1f22;color:#dbdee1;box-shadow:0 24px 70px rgba(0,0,0,.65);font-family:Inter,system-ui,sans-serif}.tos-gate-head{padding:20px 22px 14px;border-bottom:1px solid rgba(255,255,255,.08)}.tos-gate-head h2{margin:0;color:#fff;font-size:23px}.tos-gate-head p{margin:6px 0 0;color:#949ba4;font-size:13px;line-height:1.45}.tos-gate-preview{margin:15px 20px 0;padding:14px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#111214;font-size:13px;line-height:1.5}.tos-gate-preview h3{margin:0 0 8px;color:#fff}.tos-gate-preview ul{margin:7px 0 7px 20px;padding:0}.tos-gate-preview a{color:#8ea1ff}.tos-accept-row{display:flex;align-items:flex-start;gap:9px;padding:14px 20px 5px;font-size:13px;line-height:1.4}.tos-accept-row input{margin-top:3px;accent-color:#5865f2}.tos-gate-error{min-height:18px;padding:3px 20px;color:#fa777c;font-size:12px}.tos-gate-actions{display:flex;gap:9px;padding:8px 20px 20px}.tos-gate-actions button{border:0;border-radius:8px;padding:11px 15px;font:inherit;font-weight:800;cursor:pointer}.tos-accept-btn{flex:1;background:#5865f2;color:#fff}.tos-accept-btn:disabled{opacity:.45;cursor:not-allowed}.tos-decline-btn{background:#4e5058;color:#fff}`;
  document.head.appendChild(style);
  const gate = document.createElement('div');
  gate.id = 'tos-gate';
  gate.hidden = true;
  gate.innerHTML = `<div class="tos-gate-card" role="dialog" aria-modal="true" aria-labelledby="tos-gate-title"><div class="tos-gate-head"><h2 id="tos-gate-title">Accept the Terms of Service</h2><p>You must read and accept the current Avern Terms of Service before entering the chat.</p></div><div class="tos-gate-preview"><h3>Terms of Service</h3><strong>Last updated: October 5, 2026</strong><ul><li>Follow all server rules and moderator instructions.</li><li>Harassment, threats, ban evasion, spam, abuse of powers, and sharing another person's private information are prohibited.</li><li>Moderators may issue mutes, bans, or other actions based on the circumstances.</li><li>Messages, including deleted messages and DMs, may be visible to the server owner.</li></ul><a href="tos.html" target="_blank" rel="noopener">Open and read the complete Terms of Service</a></div><label class="tos-accept-row"><input id="tos-accept-check" type="checkbox"><span>I have read and agree to the complete Terms of Service and server rules.</span></label><div id="tos-gate-error" class="tos-gate-error" aria-live="polite"></div><div class="tos-gate-actions"><button class="tos-decline-btn" type="button" id="tos-decline-btn">Log out</button><button id="tos-accept-btn" class="tos-accept-btn" type="button" disabled>Accept and continue</button></div></div>`;
  document.body.appendChild(gate);
  const check = document.getElementById('tos-accept-check');
  const accept = document.getElementById('tos-accept-btn');
  check.addEventListener('change', () => { accept.disabled = !check.checked; });
  accept.addEventListener('click', acceptTos);
  document.getElementById('tos-decline-btn').addEventListener('click', declineTos);
}

function showTosGate(user, usernameLower) {
  buildTosGate();
  pendingTosAccount = { user, usernameLower };
  document.getElementById('auth-screen').hidden = true;
  document.getElementById('tos-accept-check').checked = false;
  document.getElementById('tos-accept-btn').disabled = true;
  document.getElementById('tos-accept-btn').textContent = 'Accept and continue';
  document.getElementById('tos-gate-error').textContent = '';
  document.getElementById('tos-gate').hidden = false;
}

async function acceptTos() {
  if (!pendingTosAccount || !document.getElementById('tos-accept-check').checked) return;
  const button = document.getElementById('tos-accept-btn');
  const error = document.getElementById('tos-gate-error');
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    await db.ref('chat_profiles/' + pendingTosAccount.usernameLower).update({
      tosAcceptedVersion: AVERN_TOS_VERSION,
      tosAcceptedAt: firebase.database.ServerValue.TIMESTAMP,
      tosAcceptedUid: pendingTosAccount.user.uid
    });
    const user = pendingTosAccount.user;
    pendingTosAccount = null;
    document.getElementById('tos-gate').hidden = true;
    await window.avernBootWithoutTosCheck(user);
  } catch (err) {
    console.error('TOS acceptance save failed:', err);
    error.textContent = 'Could not save your acceptance. Check your connection and try again.';
    button.disabled = false;
    button.textContent = 'Accept and continue';
  }
}

async function declineTos() {
  pendingTosAccount = null;
  await auth.signOut();
  location.reload();
}

buildTosGate();
const originalAvernBoot = bootAuthenticatedAccount;
window.avernBootWithoutTosCheck = originalAvernBoot;
bootAuthenticatedAccount = async function(user) {
  try {
    const usernameSnap = await db.ref('uid_usernames/' + user.uid).once('value');
    const usernameLower = String(usernameSnap.val() || '').toLowerCase();
    if (!usernameLower) return originalAvernBoot(user);
    const profileSnap = await db.ref('chat_profiles/' + usernameLower).once('value');
    const profile = profileSnap.val() || {};
    if (String(profile.tosAcceptedVersion || '') !== AVERN_TOS_VERSION) {
      showTosGate(user, usernameLower);
      return;
    }
    return originalAvernBoot(user);
  } catch (err) {
    console.error('TOS check failed:', err);
    document.getElementById('auth-screen').hidden = false;
    authMsg('Could not verify the Terms of Service status. Check your connection and try again.');
  }
};
