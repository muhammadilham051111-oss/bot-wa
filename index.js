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

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("Jefri Bot Berhasil Terhubung dan Siap Merespons!");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;

            // Debug log ke Railway untuk melihat setiap pesan yang masuk
            console.log("Pesan diterima dari:", mek.key.remoteJid);

            const messageType = Object.keys(mek.message)[0];
            let textMessage = "";

            if (messageType === "conversation") {
                textMessage = mek.message.conversation;
            } else if (messageType === "extendedTextMessage") {
                textMessage = mek.message.extendedTextMessage.text;
            } else if (messageType === "imageMessage" && mek.message.imageMessage.caption) {
                textMessage = mek.message.imageMessage.caption;
            }

            if (!textMessage) return;
            console.log("Isi Teks:", textMessage);

            const remoteJid = mek.key.remoteJid;
            const command = textMessage.trim().toLowerCase();

            // Respon otomatis untuk perintah ping
            if (command === "!ping" || command === ".ping") {
                await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Bot Jefri merespons dengan cepat." }, { quoted: mek });
            }
        } catch (err) {
            console.log("Error pada handler pesan:", err);
        }
    });
}

startBot();
