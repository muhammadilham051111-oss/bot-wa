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
            console.log("Jefri Bot Berhasil Terhubung secara Cepat!");
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        try {
            for (const msg of m.messages) {
                if (!msg.message) continue;

                const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                if (!textMessage) continue;

                const remoteJid = msg.key.remoteJid;
                const command = textMessage.trim().toLowerCase();

                // Balas !ping maupun .ping (Bisa dari kamu sendiri maupun orang lain)
                if (command === "!ping" || command === ".ping") {
                    await sock.sendMessage(remoteJid, { text: "Pong! ⚡ Respon cepat aktif." }, { quoted: msg });
                }
            }
        } catch (err) {
            // Abaikan error minor
        }
    });
}

startBot();
