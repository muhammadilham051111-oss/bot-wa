const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const C = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", magenta: "\x1b[35m", gray: "\x1b[90m", bold: "\x1b[1m" };

function log(label, color, message) { 
    console.log(`${color}${label}${C.reset} ${message}`); 
}

let isStarting = false; 
let reconnectTimer = null; 
let activeSock = null;

async function startBot() { 
    if (isStarting) { 
        log("[INFO]", C.yellow, "Proses koneksi sedang berjalan."); 
        return; 
    }
    isStarting = true;

    try {
        const authDir = path.resolve("./auth_info");
        fs.mkdirSync(authDir, { recursive: true });

        const credsPath = path.join(authDir, "creds.json");
        const sessionData = process.env.SESSION_DATA;

        if (sessionData && !fs.existsSync(credsPath)) {
            try {
                const creds = JSON.parse(
                    Buffer.from(sessionData, "base64").toString("utf-8")
                );

                fs.writeFileSync(
                    credsPath,
                    JSON.stringify(creds, null, 2),
                    { mode: 0o600 }
                );

                log("[SESI]", C.green, "Sesi awal berhasil dimuat dari environment.");
            } catch (err) {
                log("[ERROR SESI]", C.red, err.message);
                return;
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const sock = makeWASocket({
            logger: pino({ level: "silent" }),
            auth: state,
            browser: ["Ubuntu", "Chrome", "110.0.0.0"],
            markOnlineOnConnect: true
        });

        activeSock = sock;

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async update => {
            const { connection, lastDisconnect } = update;

            if (connection === "connecting") {
                log("[KONEKSI]", C.yellow, "Sedang menghubungkan ke WhatsApp...");
            }

            if (connection === "open") {
                log("[KONEKSI]", C.green + C.bold, "BOT BERHASIL TERHUBUNG & SIAP!");
                log("[IDENTITAS BOT]", C.cyan, sock.user?.id || "ID belum tersedia");
            }

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                log("[KONEKSI TERPUTUS]", C.red, `Kode=${statusCode ?? "tidak diketahui"} | Reconnect=${shouldReconnect}`);

                if (activeSock === sock) activeSock = null;

                if (shouldReconnect && !reconnectTimer) {
                    reconnectTimer = setTimeout(async () => {
                        reconnectTimer = null;
                        await startBot();
                    }, 3000);
                } else if (!shouldReconnect) {
                    log("[SESI]", C.red, "Sesi logout.");
                }
            }
        });

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            log("[EVENT PESAN]", C.cyan + C.bold, `type=${type} | jumlah=${messages?.length || 0}`);

            for (const mek of messages || []) {
                try {
                    if (!mek || !mek.message) continue;

                    const jid = mek.key?.remoteJid;
                    if (!jid || jid === "status@broadcast") continue;

                    let msg = mek.message;

                    // Unwrap pembungkus pesan lengkap
                    while (msg) {
                        if (msg.ephemeralMessage?.message) {
                            msg = msg.ephemeralMessage.message;
                        } else if (msg.viewOnceMessage?.message) {
                            msg = msg.viewOnceMessage.message;
                        } else if (msg.viewOnceMessageV2?.message) {
                            msg = msg.viewOnceMessageV2.message;
                        } else if (msg.viewOnceMessageV2Extension?.message) {
                            msg = msg.viewOnceMessageV2Extension.message;
                        } else if (msg.documentWithCaptionMessage?.message) {
                            msg = msg.documentWithCaptionMessage.message;
                        } else if (msg.editedMessage?.message) {
                            msg = msg.editedMessage.message;
                        } else {
                            break;
                        }
                    }

                    // Ekstraksi teks dari berbagai kemungkinan objek Baileys
                    const textMessage =
                        msg.conversation ||
                        msg.extendedTextMessage?.text ||
                        msg.imageMessage?.caption ||
                        msg.videoMessage?.caption ||
                        msg.documentMessage?.caption ||
                        msg.buttonsResponseMessage?.selectedDisplayText ||
                        msg.listResponseMessage?.title ||
                        msg.templateButtonReplyMessage?.selectedDisplayText ||
                        "";

                    log("[CHAT]", C.blue, `JID=${jid}`);
                    log("[ISI PESAN DETEKSI]", textMessage ? C.green : C.yellow, textMessage ? JSON.stringify(textMessage) : `Teks kosong | Key Types: ${Object.keys(msg).join(", ")}`);

                    if (!textMessage.trim()) continue;

                    // Biarkan event "notify" atau pesan baru diolah
                    if (mek.key?.fromMe) continue;

                    const command = textMessage.trim().toLowerCase();

                    log("[COMMAND]", C.cyan, command);

                    if (command === "!ping" || command === ".ping") {
                        await sock.sendMessage(jid, { text: "Pong! ⚡ Bot Jefri berhasil merespons dari Railway!" }, { quoted: mek });
                        log("[SUKSES]", C.green + C.bold, `Balasan ping terkirim ke ${jid}`);
                    } else if (command === "!menu" || command === ".menu") {
                        await sock.sendMessage(jid, { text: "🤖 MENU BOT JEFRI\n\n• !ping\n• !menu\n\nStatus: Online" }, { quoted: mek });
                        log("[SUKSES]", C.green + C.bold, `Menu terkirim ke ${jid}`);
                    }

                } catch (err) {
                    log("[ERROR HANDLER]", C.red + C.bold, err?.stack || String(err));
                }
            }
        });

    } catch (err) {
        log("[ERROR STARTBOT]", C.red + C.bold, err?.stack || String(err));
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(async () => {
                reconnectTimer = null;
                await startBot();
            }, 5000);
        }
    } finally {
        isStarting = false;
    }
}

startBot();
