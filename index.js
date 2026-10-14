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
            console.log("=== BOT TERHUBUNG & SIAP 100% ===");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    // Wajib ada agar riwayat dan pesan grup tersinkronisasi di Baileys
    sock.ev.on("messaging-history.set", ({ messages }) => {
        console.log(`[SYNC] Sinkronisasi riwayat pesan berhasil: ${messages.length} pesan`);
    });

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        console.log("--> ADA EVENT PESAN MASUK (UPSERT TERPANGGIL)!");
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;

            const textMessage = mek.message.conversation || 
                                mek.message.extendedTextMessage?.text || 
                                mek.message.imageMessage?.caption || "";

            if (!textMessage) return;

            const remoteJid = mek.key.remoteJid;
            console.log(`[PESAN DITERIMA] Dari ${remoteJid}: "${textMessage}"`);

            const command = textMessage.trim().toLowerCase();

            if (command === "!ping" || command === ".ping") {
                await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Bot Jefri Berhasil Merespons!" }, { quoted: mek });
                console.log("-> Berhasil membalas !ping!");
            } else if (command === "!menu" || command === ".menu") {
                await sock.sendMessage(remoteJid, { text: "🤖 Menu Bot Jefri Aktif & Normal!" }, { quoted: mek });
                console.log("-> Berhasil membalas !menu!");
            }
        } catch (err) {
            console.log("Error handler:", err);
        }
    });
}

startBot();
