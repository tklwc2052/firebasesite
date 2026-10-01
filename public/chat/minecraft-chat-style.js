/* Avern Minecraft message formatter
   Loads after the main Avern scripts and changes only rendered MC rows.
   It does not create Firebase accounts or write to the database. */
(function () {
    "use strict";

    function formatMinecraftRow(row) {
        if (!row || row.dataset.minecraftFormatted === "true") return;

        const body = row.querySelector(".msg-body");
        if (!body) return;

        const rawText = String(body.textContent || "");
        if (!/^\[Minecraft\]\s*/i.test(rawText)) return;

        const userNode = row.querySelector(".msg-user");
        const timeNode = row.querySelector(".msg-time");
        const username = String(userNode?.textContent || row.dataset.user || "Minecraft").trim();
        const timestamp = String(timeNode?.textContent || "").trim();
        const message = rawText.replace(/^\[Minecraft\]\s*/i, "");

        const line = document.createElement("div");
        line.className = "minecraft-bridge-line";

        const user = document.createElement("span");
        user.className = "minecraft-bridge-user";
        user.textContent = "<" + username + ">";

        const time = document.createElement("span");
        time.className = "minecraft-bridge-time";
        time.textContent = timestamp ? "[" + timestamp + "]" : "";

        const separator = document.createElement("span");
        separator.textContent = " : ";

        const messageNode = document.createElement("span");
        messageNode.className = "minecraft-bridge-text";
        messageNode.textContent = message;

        line.append(user, time, separator, messageNode);
        row.replaceChildren(line);
        row.className = "msg-group minecraft-bridge-message";
        row.dataset.minecraftFormatted = "true";
        row.setAttribute("data-has-reply", "false");
    }

    function formatAll(root) {
        if (!root) return;
        if (root.matches?.(".msg-group")) formatMinecraftRow(root);
        root.querySelectorAll?.(".msg-group").forEach(formatMinecraftRow);
    }

    function start() {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        formatAll(chatBox);

        const observer = new MutationObserver(function (records) {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) formatAll(node);
                }
            }
        });

        observer.observe(chatBox, { childList: true, subtree: true });
    }

    const style = document.createElement("style");
    style.textContent = `
        .msg-group.minecraft-bridge-message {
            display: block !important;
            min-height: 0 !important;
            padding: 1px 8px !important;
            margin: 0 !important;
        }
        .minecraft-bridge-line {
            color: var(--text-normal);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-size: 14px;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
        .minecraft-bridge-user {
            color: var(--text-normal) !important;
            font-weight: 700;
        }
        .minecraft-bridge-time {
            color: var(--text-muted);
        }
    `;
    document.head.appendChild(style);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
