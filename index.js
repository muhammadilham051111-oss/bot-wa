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
        browser: ["Ubuntu", "Chrome", "20.04.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("Jefri Bot Berhasil Terhubung ke WhatsApp!");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Koneksi terputus, mencoba menghubungkan ulang...", shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        for (const msg of m.messages) {
            if (!msg.message) continue;

            // Ambil isi teks pesan
            const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
            const remoteJid = msg.key.remoteJid;

            console.log(`[PESAN MASUK] Dari: ${remoteJid} | Isi: ${textMessage}`);

            // Respon jika mengetik !ping (Abaikan kapitalisasi / spasi)
            if (textMessage.trim().toLowerCase() === "!ping") {
                await sock.sendMessage(remoteJid, { text: "Pong! Bot Jefri aktif 24/7." }, { quoted: msg });
            }
        }
    });
}

startBot();
