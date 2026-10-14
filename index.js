const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const authDir = path.resolve("./auth_info");

async function syncSessionFromMongo() {
    if (!MONGODB_URI) return;
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db("whatsapp_bot");
        const collection = db.collection("sessions");
        
        const docs = await collection.find({}).toArray();
        if (docs.length > 0) {
            fs.mkdirSync(authDir, { recursive: true });
            for (const doc of docs) {
                fs.writeFileSync(path.join(authDir, doc.filename), doc.data);
            }
            console.log("[MONGODB] Sesi berhasil dimuat dari database.");
        }
        await client.close();
    } catch (err) {
        console.log("[MONGODB ERROR SYNC IN]", err.message);
    }
}

async function saveSessionToMongo() {
    if (!MONGODB_URI) return;
    try {
        if (!fs.existsSync(authDir)) return;
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db("whatsapp_bot");
        const collection = db.collection("sessions");

        const files = fs.readdirSync(authDir);
        for (const file of files) {
            const filePath = path.join(authDir, file);
            if (fs.statSync(filePath).isFile()) {
                const data = fs.readFileSync(filePath, "utf-8");
                await collection.updateOne(
                    { filename: file },
                    { $set: { filename: file, data: data } },
                    { upsert: true }
                );
            }
        }
        await client.close();
    } catch (err) {
        console.log("[MONGODB ERROR SYNC OUT]", err.message);
    }
}

const C = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", bold: "\x1b[1m" };
function log(label, color, message) { console.log(`${color}${label}${C.reset} ${message}`); }

let isStarting = false;
let reconnectTimer = null;

async function startBot() {
    if (isStarting) return;
    isStarting = true;

    await syncSessionFromMongo();

    try {
        fs.mkdirSync(authDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const sock = makeWASocket({
            logger: pino({ level: "silent" }),
            auth: state,
            browser: ["Ubuntu", "Chrome", "110.0.0.0"],
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", async () => {
            await saveCreds();
            await saveSessionToMongo();
        });

        sock.ev.on("connection.update", async update => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                log("[KONEKSI]", C.green + C.bold, "BOT BERHASIL TERHUBUNG & SIAP!");
                await saveSessionToMongo();
            }
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect && !reconnectTimer) {
                    reconnectTimer = setTimeout(async () => {
                        reconnectTimer = null;
                        await startBot();
                    }, 3000);
                }
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const mek of messages || []) {
                if (!mek.message || mek.key?.fromMe) continue;
                const jid = mek.key?.remoteJid;
                let msg = mek.message;
                while (msg) {
                    if (msg.ephemeralMessage?.message) msg = msg.ephemeralMessage.message;
                    else if (msg.viewOnceMessage?.message) msg = msg.viewOnceMessage.message;
                    else break;
                }
                const text = msg.conversation || msg.extendedTextMessage?.text || "";
                if (text.trim().toLowerCase() === "!ping") {
                    await sock.sendMessage(jid, { text: "Pong! ⚡ Bot aktif menggunakan MongoDB Atlas!" }, { quoted: mek });
                }
            }
        });

    } catch (err) {
        log("[ERROR]", C.red, err.message);
    } finally {
        isStarting = false;
    }
}

startBot();
