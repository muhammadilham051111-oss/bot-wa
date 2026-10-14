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
        browser: ["Ubuntu", "Chrome", "110.0.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        console.log("Status Koneksi:", update);
        if (connection === "open") {
            console.log("=== BOT BERHASIL TERHUBUNG & SIAP MENERIMA PESAN ===");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Koneksi terputus, mencoba reconnect:", shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    // Tangkap SEMUA event pesan masuk secara mentah
    sock.ev.on("messages.upsert", async (chatUpdate) => {
        console.log("EVENT MENGIRIM DATA UPSERT:", JSON.stringify(chatUpdate, null, 2));
        
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;

            const textMessage = mek.message.conversation || 
                                mek.message.extendedTextMessage?.text || 
                                mek.message.imageMessage?.caption || "";

            if (!textMessage) return;

            const remoteJid = mek.key.remoteJid;
            console.log(`[PESAN MASUK] Dari ${remoteJid}: "${textMessage}"`);

            const command = textMessage.trim().toLowerCase();

            if (command === "!ping" || command === ".ping") {
                await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Bot merespons!" }, { quoted: mek });
                console.log("-> Berhasil membalas !ping");
            } else if (command === "!menu" || command === ".menu") {
                await sock.sendMessage(remoteJid, { text: "🤖 Menu Bot Jefri Aktif!" }, { quoted: mek });
                console.log("-> Berhasil membalas !menu");
            }
        } catch (err) {
            console.log("Error pada upsert handler:", err);
        }
    });
}

startBot();
