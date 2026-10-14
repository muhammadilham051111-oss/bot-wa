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
            console.log("=== BOT SIAP MENANGKAP PESAN GRUP ===");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;

            // Unwrap ephemeralMessage jika grup menggunakan pesan sementara
            let msgContent = mek.message;
            if (msgContent.ephemeralMessage) {
                msgContent = msgContent.ephemeralMessage.message;
            }

            // Ekstrak teks dengan aman dari berbagai bentuk pesan
            const textMessage = msgContent.conversation || 
                                msgContent.extendedTextMessage?.text || 
                                msgContent.imageMessage?.caption || "";

            if (!textMessage) return;

            const remoteJid = mek.key.remoteJid;
            console.log(`[PESAN MASUK] Dari ${remoteJid}: "${textMessage}"`);

            const command = textMessage.trim().toLowerCase();

            if (command === "!ping" || command === ".ping") {
                await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Bot Jefri Berhasil Merespons!" }, { quoted: mek });
                console.log("-> Berhasil membalas !ping");
            } else if (command === "!menu" || command === ".menu") {
                const menuText = `🤖 *MENU BOT JEFRI* 🤖\n\n` +
                                 `• !ping / .ping\n` +
                                 `• !menu / .menu\n\n` +
                                 `Status: Online & Normal!`;
                await sock.sendMessage(remoteJid, { text: menuText }, { quoted: mek });
                console.log("-> Berhasil membalas !menu");
            }
        } catch (err) {
            console.log("Error handler:", err);
        }
    });
}

startBot();
