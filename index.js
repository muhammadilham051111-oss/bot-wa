const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

async function startBot() {
    const authDir = path.join(__dirname, "auth_info");
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    if (process.env.SESSION_DATA && !fs.existsSync(path.join(authDir, "creds.json"))) {
        const sessionBuffer = Buffer.from(process.env.SESSION_DATA, "base64");
        fs.writeFileSync(path.join(authDir, "creds.json"), sessionBuffer);
        console.log("LOG: Berhasil memuat SESSION_DATA dari variabel lingkungan.");
    }
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.04.0"]
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log("Koneksi terputus, mencoba menghubungkan ulang...", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("Bot Jefri Berhasil Terhubung dan Siap Digunakan!");
        }
    });
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (body === "!ping") {
            await sock.sendMessage(msg.key.remoteJid, { text: "Pong! Bot Jefri aktif 24/7." });
        }
    });
}
startBot();
