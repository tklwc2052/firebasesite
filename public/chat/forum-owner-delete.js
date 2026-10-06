/* Avern: let regular users delete forum threads they created. */
(function () {
    function normalize(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isOwner(post) {
        return Boolean(
            post &&
            typeof sessionUser !== 'undefined' &&
            normalize(post.author) === normalize(sessionUser.username)
        );
    }

    function getCurrentPost() {
        if (typeof activeForumPostData !== 'undefined' && activeForumPostData) {
            return activeForumPostData;
        }

        if (
            typeof forumPostCache !== 'undefined' &&
            typeof activeForumPost !== 'undefined' &&
            activeForumPost
        ) {
            return forumPostCache[activeForumPost] || null;
        }

        return null;
    }

    async function deleteCurrentOwnedThread() {
        const post = getCurrentPost();

        if (!post || !isOwner(post)) {
            alert('Only the person who created this thread can use this button.');
            return;
        }

        if (!confirm(`Delete "${post.title || 'this thread'}" and all replies? This cannot be undone.`)) {
            return;
        }

        try {
            const channel = activeChannel;
            const postKey = activeForumPost;

            await db.ref(`forum_channels/${channel}/posts/${postKey}`).remove();

            activeForumPost = null;
            activeForumPostData = null;

            if (typeof closeForumSplitUi === 'function') closeForumSplitUi();
            if (typeof changeChannel === 'function') changeChannel(channel, false);
        } catch (error) {
            console.error('Could not delete owned forum thread:', error);
            alert('The thread could not be deleted. Your Firebase rules may be blocking the delete.');
        }
    }

    function syncOwnerDeleteButton() {
        const controls = document.querySelector('.forum-thread-op .forum-thread-actions');
        const existing = document.getElementById('forum-owner-delete-button');
        const post = getCurrentPost();
        const forumOpen =
            typeof isForumMode !== 'undefined' && isForumMode &&
            typeof activeForumPost !== 'undefined' && activeForumPost;

        if (!controls || !forumOpen || !isOwner(post)) {
            existing?.remove();
            return;
        }

        if (existing) return;

        const button = document.createElement('button');
        button.id = 'forum-owner-delete-button';
        button.className = 'forum-subtle-btn';
        button.type = 'button';
        button.textContent = 'Delete thread';
        button.addEventListener('click', deleteCurrentOwnedThread);
        controls.appendChild(button);
    }

    function initializeOwnerDelete() {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;

        syncOwnerDeleteButton();
        new MutationObserver(syncOwnerDeleteButton).observe(chatBox, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initializeOwnerDelete);
    } else {
        initializeOwnerDelete();
    }
})();
