
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
    const sessionData = process.env.SESSION_DATA;
    if (sessionData) {
        const creds = JSON.parse(Buffer.from(sessionData, "base64").toString("utf-8"));
        require("fs").mkdirSync("./auth_info", { recursive: true });
        require("fs").writeFileSync("./auth_info/creds.json", JSON.stringify(creds, null, 2));
    }

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "110.0.0.0"],
        markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("=== BOT BERHASIL TERHUBUNG & SIAP ===");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        console.log(`[EVENT PESAN] type=${type}, jumlah=${messages?.length || 0}`);

        for (const mek of messages || []) {
            try {
                if (!mek.message) continue;

                const jid = mek.key.remoteJid;
                if (!jid || jid === "status@broadcast") continue;

                let msg = mek.message;

                while (msg) {
                    if (msg.ephemeralMessage?.message) {
                        msg = msg.ephemeralMessage.message;
                    } else if (msg.viewOnceMessage?.message) {
                        msg = msg.viewOnceMessage.message;
                    } else if (msg.viewOnceMessageV2?.message) {
                        msg = msg.viewOnceMessageV2.message;
                    } else if (msg.documentWithCaptionMessage?.message) {
                        msg = msg.documentWithCaptionMessage.message;
                    } else {
                        break;
                    }
                }

                const textMessage =
                    msg.conversation ||
                    msg.extendedTextMessage?.text ||
                    msg.imageMessage?.caption ||
                    msg.videoMessage?.caption ||
                    msg.documentMessage?.caption ||
                    "";

                console.log(
                    `[PESAN MASUK] jid=${jid} fromMe=${!!mek.key.fromMe} text=${JSON.stringify(textMessage)}`
                );

                if (!textMessage.trim()) continue;

                const command = textMessage.trim().toLowerCase();

                if (command === "!ping" || command === ".ping") {
                    await sock.sendMessage(
                        jid,
                        { text: "Pong! ⚡ Bot Jefri berhasil merespons!" },
                        { quoted: mek }
                    );
                    console.log(`[BALASAN BERHASIL] ${jid}`);
                } else if (command === "!menu" || command === ".menu") {
                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                "🤖 MENU BOT JEFRI\n\n" +
                                "• !ping / .ping\n" +
                                "• !menu / .menu\n\n" +
                                "Status: Online"
                        },
                        { quoted: mek }
                    );
                    console.log(`[MENU TERKIRIM] ${jid}`);
                }
            } catch (err) {
                console.error("[ERROR HANDLER PESAN]", err?.stack || err);
            }
        }
    });
}

startBot();
