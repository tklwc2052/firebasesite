/* Avern: allow forum creators to delete their own threads. */
(function () {
    function currentUsernameLower() {
        return String(window.sessionUser?.username || '').trim().toLowerCase();
    }

    function isForumPostCreator(post) {
        return Boolean(
            post &&
            String(post.author || '').trim().toLowerCase() === currentUsernameLower()
        );
    }

    function getForumPost(postKey) {
        if (window.activeForumPost === postKey && window.activeForumPostData) {
            return window.activeForumPostData;
        }
        return window.forumPostCache?.[postKey] || null;
    }

    window.deleteOwnForumPost = async function (postKey) {
        const post = getForumPost(postKey);
        const canModerate = typeof window.forumCan === 'function' && window.forumCan('forums.delete');

        if (!isForumPostCreator(post) && !canModerate) {
            alert('Only the thread creator or a forum moderator can delete this thread.');
            return;
        }

        if (!confirm(`Delete "${post?.title || 'this thread'}" and all of its replies? This cannot be undone.`)) {
            return;
        }

        try {
            await db.ref(`forum_channels/${activeChannel}/posts/${postKey}`).remove();

            if (activeForumPost === postKey) {
                activeForumPost = null;
                activeForumPostData = null;
                openForumChannel(activeChannel);
            }
        } catch (error) {
            console.error('Forum thread deletion failed:', error);
            alert('The thread could not be deleted. Check the Firebase database rules.');
        }
    };

    /* Keep moderator deletion working while adding creator-owned deletion. */
    window.deleteForumPost = function (postKey) {
        return window.deleteOwnForumPost(postKey);
    };

    /* Add the button to the expanded thread's main-post controls. */
    if (typeof window.forumThreadActions === 'function') {
        const originalForumThreadActions = window.forumThreadActions;

        window.forumThreadActions = function (post) {
            let controls = originalForumThreadActions(post) || '';
            const canModerate = typeof window.forumCan === 'function' && window.forumCan('forums.delete');

            if (isForumPostCreator(post) && !canModerate) {
                controls += `<button class="forum-subtle-btn" onclick="deleteOwnForumPost('${escapeForSingleQuote(activeForumPost)}')">Delete thread</button>`;
            }

            return controls;
        };
    }
})();
