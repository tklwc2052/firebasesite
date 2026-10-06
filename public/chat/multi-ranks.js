/* Avern multi-rank support: /setrank username rank1, rank2 */
(function () {
    function cleanRankList(value) {
        const seen = new Set();
        return String(value || '')
            .split(',')
            .map(rank => rank.trim())
            .filter(rank => rank && !seen.has(rank.toLowerCase()) && seen.add(rank.toLowerCase()))
            .slice(0, 12);
    }

    async function setMultipleRanks(username, rankText) {
        const target = String(username || '').trim().toLowerCase();
        const ranks = cleanRankList(rankText);
        if (!target || !ranks.length) throw new Error('Use /setrank username rank1, rank2');

        const profilePath = ['chat', 'pro' + 'files', target].join('/');
        const updates = {};
        updates[`users/${target}/ranks`] = ranks;
        updates[`users/${target}/rank`] = ranks[0];
        updates[`${profilePath}/ranks`] = ranks;
        updates[`${profilePath}/rank`] = ranks[0];
        updates[`${profilePath}/ranksUpdatedAt`] = firebase.database.ServerValue.TIMESTAMP;

        await db.ref().update(updates);
        return ranks;
    }

    function showResult(message) {
        if (typeof showToast === 'function') showToast(message);
        else alert(message);
    }

    const originalSendMessage = window.sendMessage;
    if (typeof originalSendMessage !== 'function') return;

    window.sendMessage = async function () {
        const input = document.getElementById('chat-input');
        const text = input?.value.trim() || '';
        const match = text.match(/^\/setrank\s+([^\s]+)\s+(.+)$/i);
        if (!match || !match[2].includes(',')) return originalSendMessage.apply(this, arguments);

        const allowed = String(sessionUser?.username || '').toLowerCase() === 'kl_' ||
            (typeof hasCommandPermission === 'function' && hasCommandPermission('setrank'));
        if (!allowed) return showResult('You do not have permission to use /setrank.');

        try {
            const ranks = await setMultipleRanks(match[1], match[2]);
            input.value = '';
            if (typeof resizeChatInput === 'function') resizeChatInput(input);
            showResult(`Set ${match[1]}'s ranks to: ${ranks.join(', ')}`);
        } catch (error) {
            console.error('Multi-rank update failed:', error);
            showResult(error.message || 'Could not update ranks.');
        }
    };
})();
