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
            console.log("=== BOT JEFRI AKTIF & SIAP DENGAN FITUR BARU ===");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            for (const mek of chatUpdate.messages) {
                if (!mek.message) continue;

                // Ambil teks dari berbagai jenis pesan
                const textMessage = mek.message.conversation || 
                                    mek.message.extendedTextMessage?.text || 
                                    mek.message.imageMessage?.caption || "";

                if (!textMessage) continue;

                const remoteJid = mek.key.remoteJid;
                const isGroup = remoteJid.endsWith("@g.us");
                const args = textMessage.trim().split(/ +/);
                const command = args.shift().toLowerCase();

                console.log(`[PESAN MASUK] ${remoteJid}: ${textMessage}`);

                // --- HANDLER COMMAND ---

                // 1. Perintah !ping / .ping
                if (command === "!ping" || command === ".ping") {
                    await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Bot Jefri aktif 24/7 di Railway." }, { quoted: mek });
                }

                // 2. Perintah !menu / .menu
                else if (command === "!menu" || command === ".menu") {
                    const menuText = `🤖 *JEFRI BOT MULTI-FUNCTION* 🤖\n\n` +
                                     `📌 *Daftar Perintah:*\n` +
                                     `• *!ping* / *.ping* - Cek respon bot\n` +
                                     `• *!menu* / *.menu* - Menampilkan daftar perintah\n` +
                                     `• *!hidetag <teks>* - Tag semua anggota grup\n` +
                                     `• *!info* - Informasi bot\n\n` +
                                     `⚡ *Status:* Online (Railway Singapore)`;
                    await sock.sendMessage(remoteJid, { text: menuText }, { quoted: mek });
                }

                // 3. Perintah !info / .info
                else if (command === "!info" || command === ".info") {
                    await sock.sendMessage(remoteJid, { text: "ℹ️ *Jefri Bot* dikembangkan menggunakan Node.js & Baileys Multi-Device, di-host di Railway." }, { quoted: mek });
                }

                // 4. Perintah !hidetag (Khusus Grup)
                else if ((command === "!hidetag" || command === ".hidetag") && isGroup) {
                    const groupMetadata = await sock.groupMetadata(remoteJid);
                    const participants = groupMetadata.participants.map(p => p.id);
                    const tagMessage = args.join(" ") || "Pengumuman!";
                    
                    await sock.sendMessage(remoteJid, { text: tagMessage, mentions: participants });
                }
            }
        } catch (err) {
            console.log("Error handling command:", err);
        }
    });
}

startBot();
