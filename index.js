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
        const { connection } = update;
        if (connection === "open") {
            console.log("=== BOT JEFRI SIAP 100% ===");
        }
    });

    // Perbaikan total penangkapan event pesan masuk
    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            // Jangan proses pesan dari status/broadcast
            if (mek.key.remoteJid === "status@broadcast") return;

            // Ekstrak teks dari berbagai kemungkinan struktur pesan WhatsApp
            const type = Object.keys(mek.message)[0];
            let body = "";

            if (type === "conversation") {
                body = mek.message.conversation;
            } else if (type === "extendedTextMessage") {
                body = mek.message.extendedTextMessage.text;
            } else if (type === "imageMessage" && mek.message.imageMessage.caption) {
                body = mek.message.imageMessage.caption;
            } else if (type === "videoMessage" && mek.message.videoMessage.caption) {
                body = mek.message.videoMessage.caption;
            }

            if (!body) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            const args = body.trim().split(/ +/);
            const command = args.shift().toLowerCase();

            console.log(`[PESAN DITERIMA] Dari: ${from} | Isi: ${body}`);

            // Eksekusi Perintah
            switch (command) {
                case "!ping":
                case ".ping":
                    await sock.sendMessage(from, { text: "Pong! ⚡ Bot Jefri Berhasil Merespons!" }, { quoted: mek });
                    console.log("--> Berhasil membalas !ping");
                    break;

                case "!menu":
                case ".menu":
                    const menuText = `🤖 *MENU BOT JEFRI* 🤖\n\n` +
                                     `• !ping / .ping\n` +
                                     `• !menu / .menu\n` +
                                     `• !info\n\n` +
                                     `Status: Terhubung & Normal!`;
                    await sock.sendMessage(from, { text: menuText }, { quoted: mek });
                    console.log("--> Berhasil membalas !menu");
                    break;

                case "!info":
                    await sock.sendMessage(from, { text: "Bot Jefri aktif menggunakan Node.js dan Baileys di Railway." }, { quoted: mek });
                    break;
            }
        } catch (err) {
            console.log("Error Utama:", err);
        }
    });
}

startBot();
