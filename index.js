
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const C = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", magenta: "\x1b[35m", gray: "\x1b[90m", bold: "\x1b[1m" };

function log(label, color, message) { 
    console.log(`${color}${label}${C.reset} ${message}`); 
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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

                log("[SESI]", C.green, "Sesi awal berhasil dimuat.");
            } catch (err) {
                log(
                    "[ERROR SESI]",
                    C.red,
                    err.message
                );
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
                log(
                    "[KONEKSI]",
                    C.yellow,
                    "Sedang menghubungkan ke WhatsApp..."
                );
            }

            if (connection === "open") {
                log(
                    "[KONEKSI]",
                    C.green + C.bold,
                    "BOT BERHASIL TERHUBUNG!"
                );

                log(
                    "[IDENTITAS BOT]",
                    C.cyan,
                    sock.user?.id || "ID belum tersedia"
                );
            }

            if (connection === "close") {
                const statusCode =
                    lastDisconnect?.error?.output?.statusCode;

                const shouldReconnect =
                    statusCode !== DisconnectReason.loggedOut;

                log(
                    "[KONEKSI TERPUTUS]",
                    C.red,
                    `Kode=${statusCode ?? "tidak diketahui"} | Reconnect=${shouldReconnect}`
                );

                if (activeSock === sock) {
                    activeSock = null;
                }

                if (shouldReconnect && !reconnectTimer) {
                    reconnectTimer = setTimeout(async () => {
                        reconnectTimer = null;
                        await startBot();
                    }, 3000);
                } else if (!shouldReconnect) {
                    log(
                        "[SESI]",
                        C.red,
                        "Sesi logout. Periksa autentikasi sebelum menautkan ulang."
                    );
                }
            }
        });

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            log(
                "[EVENT PESAN]",
                C.cyan + C.bold,
                `type=${type} | jumlah=${messages?.length || 0} | waktu=${new Date().toLocaleTimeString("id-ID")}`
            );

            for (const mek of messages || []) {
                try {
                    if (!mek) {
                        log("[SKIP]", C.yellow, "Objek pesan kosong.");
                        continue;
                    }

                    const jid = mek.key?.remoteJid;

                    if (!jid) {
                        log("[SKIP]", C.yellow, "JID tidak tersedia.");
                        continue;
                    }

                    if (jid === "status@broadcast") {
                        continue;
                    }

                    if (!mek.message) {
                        log(
                            "[PESAN KOSONG]",
                            C.yellow,
                            `JID=${jid}`
                        );
                        continue;
                    }

                    let msg = mek.message;

                    // Membuka pembungkus pesan
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
                        } else {
                            break;
                        }
                    }

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

                    const chatType = jid.endsWith("@g.us")
                        ? "GRUP"
                        : "PRIBADI";

                    const sender =
                        mek.key?.participant ||
                        mek.key?.remoteJid ||
                        "Tidak diketahui";

                    log(
                        "[CHAT]",
                        C.blue,
                        `${chatType} | JID=${jid}`
                    );

                    log(
                        "[PENGIRIM]",
                        C.magenta,
                        sender
                    );

                    log(
                        "[FROM ME]",
                        C.gray,
                        String(!!mek.key?.fromMe)
                    );

                    log(
                        "[ISI PESAN]",
                        textMessage ? C.green : C.yellow,
                        textMessage
                            ? JSON.stringify(textMessage)
                            : `Teks tidak ditemukan | tipe=${Object.keys(msg).join(",")}`
                    );

                    if (!textMessage.trim()) {
                        continue;
                    }

                    if (type !== "notify") {
                        log(
                            "[SKIP EVENT]",
                            C.gray,
                            `Event ${type} tidak diproses sebagai pesan baru.`
                        );
                        continue;
                    }

                    if (mek.key?.fromMe) {
                        log(
                            "[SKIP FROM ME]",
                            C.gray,
                            "Pesan dikirim oleh akun bot sendiri."
                        );
                        continue;
                    }

                    const command = textMessage.trim().toLowerCase();

                    log(
                        "[COMMAND]",
                        C.cyan,
                        command
                    );

                    if (command === "!ping" || command === ".ping") {
                        log(
                            "[KIRIM]",
                            C.yellow,
                            `Mengirim balasan ping ke ${jid}`
                        );

                        await sock.sendMessage(
                            jid,
                            {
                                text: "Pong! ⚡ Bot Jefri berhasil merespons!"
                            },
                            {
                                quoted: mek
                            }
                        );

                        log(
                            "[SUKSES]",
                            C.green + C.bold,
                            `Balasan ping berhasil dikirim ke ${jid}`
                        );

                    } else if (
                        command === "!menu" ||
                        command === ".menu"
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    "🤖 MENU BOT JEFRI\n\n" +
                                    "• !ping / .ping\n" +
                                    "• !menu / .menu\n\n" +
                                    "Status: Online"
                            },
                            {
                                quoted: mek
                            }
                        );

                        log(
                            "[SUKSES]",
                            C.green + C.bold,
                            `Menu berhasil dikirim ke ${jid}`
                        );

                    } else {
                        log(
                            "[TANPA COMMAND]",
                            C.gray,
                            "Pesan diterima, tetapi bukan perintah yang tersedia."
                        );
                    }

                } catch (err) {
                    log(
                        "[ERROR HANDLER]",
                        C.red + C.bold,
                        err?.stack || String(err)
                    );
                }
            }
        });

    } catch (err) {
        log(
            "[ERROR STARTBOT]",
            C.red + C.bold,
            err?.stack || String(err)
        );

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

