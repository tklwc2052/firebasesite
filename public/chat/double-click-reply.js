/* Avern: double-click or double-tap messages to reply. */
(function () {
    const DOUBLE_TAP_MS = 330;
    let lastTapNode = null;
    let lastTapAt = 0;

    function shouldIgnoreTarget(target) {
        return Boolean(target.closest(
            'button, a, input, textarea, select, ' +
            '.msg-action-trigger-bar, .msg-attached-img, .image-album-grid, ' +
            '.poll-option, .link-preview-card, .channel-jump-card, ' +
            '.custom-emoji, .forum-thread-actions'
        ));
    }

    function flashReplyTarget(node) {
        node.animate(
            [
                { backgroundColor: 'rgba(88, 101, 242, 0.20)', boxShadow: 'inset 3px 0 0 #5865f2' },
                { backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 transparent' }
            ],
            { duration: 420, easing: 'ease-out' }
        );
    }

    function hasSelectedText() {
        const selection = window.getSelection?.();
        return Boolean(selection && String(selection).trim());
    }

    function replyToMessageNode(node) {
        if (!node || !node.id?.startsWith('msg-node-') || hasSelectedText()) return;

        const messageKey = node.id.slice('msg-node-'.length);
        const username = node.getAttribute('data-user') || 'message';

        queueReplyContext(messageKey, username);
        flashReplyTarget(node);
    }

    function replyToForumOriginal(node) {
        if (!isForumMode || !activeForumPost || !activeForumPostData || hasSelectedText()) return;

        activeReplyData = {
            key: 'forum-original-' + activeForumPost,
            user: activeForumPostData.author || 'Original poster',
            msg: activeForumPostData.body || activeForumPostData.title || 'Forum post'
        };

        const replyUser = document.getElementById('reply-track-user');
        const replyBar = document.getElementById('reply-track-wrap');
        const input = document.getElementById('chat-input');

        if (replyUser) replyUser.innerText = '@' + activeReplyData.user;
        if (replyBar) replyBar.style.display = 'flex';
        if (input && !input.disabled) {
            input.focus();
            if (typeof resizeChatInput === 'function') resizeChatInput(input);
        }

        flashReplyTarget(node);
    }

    function beginReply(node) {
        if (node.classList.contains('msg-group')) replyToMessageNode(node);
        else if (node.classList.contains('forum-thread-op')) replyToForumOriginal(node);
    }

    function handleDoubleClick(event) {
        if (shouldIgnoreTarget(event.target)) return;

        const node = event.target.closest('.msg-group, .forum-thread-op');
        if (!node) return;

        event.preventDefault();
        beginReply(node);
    }

    function handleTouchTap(event) {
        if (event.pointerType !== 'touch' || shouldIgnoreTarget(event.target)) return;

        const node = event.target.closest('.msg-group, .forum-thread-op');
        if (!node) return;

        const now = Date.now();
        if (lastTapNode === node && now - lastTapAt <= DOUBLE_TAP_MS) {
            event.preventDefault();
            beginReply(node);
            lastTapNode = null;
            lastTapAt = 0;
            return;
        }

        lastTapNode = node;
        lastTapAt = now;
    }

    function initializeDoubleClickReply() {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox || chatBox.dataset.doubleClickReplyReady === 'true') return;

        chatBox.dataset.doubleClickReplyReady = 'true';
        chatBox.addEventListener('dblclick', handleDoubleClick);
        chatBox.addEventListener('pointerup', handleTouchTap, { passive: false });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initializeDoubleClickReply);
    } else {
        initializeDoubleClickReply();
    }
})();
