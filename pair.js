console.log("LOG: Starting Jefri Bot with fixed session reconnect...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

let isConnected = false;

async function startBot() {
    if (!fs.existsSync('./auth_temp')) {
        fs.mkdirSync('./auth_temp', { recursive: true });
    }

    if (process.env.SESSION_DATA) {
        try {
            const decodedData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8'));
            if (decodedData.creds) {
                fs.writeFileSync('./auth_temp/creds.json', JSON.stringify(decodedData.creds, null, 2));
            }
        } catch (e) {
            console.error("❌ Gagal memparsing SESSION_DATA:", e);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_temp');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection) {
            console.log("LOG: Status Koneksi:", connection);
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`LOG: Koneksi ditutup (Status Code: ${statusCode})`);
            
            // Hentikan looping reconnect jika terjadi conflict 440 / Logged Out
            if (statusCode === 440 || statusCode === DisconnectReason.loggedOut) {
                console.log("⚠️ Sesi mengalami konflik (440) atau Logged Out. Hapus/perbarui SESSION_DATA di Railway Variables!");
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('\n✅ BOT JEFRI BERHASIL TERHUBUNG SEPENUHNYA!\n');
            
            try {
                if (fs.existsSync('./auth_temp/creds.json')) {
                    const credsFile = fs.readFileSync('./auth_temp/creds.json', 'utf-8');
                    const base64Data = Buffer.from(JSON.stringify({ creds: JSON.parse(credsFile) })).toString('base64');
                    console.log("\n================== SESSION_DATA BARU ==================");
                    console.log(base64Data);
                    console.log("=======================================================\n");
                }
            } catch (err) {
                console.error("Gagal generate Base64:", err);
            }
        }
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const phoneNumber = process.env.NOMOR_HP;
            if (!phoneNumber) {
                console.log("⚠️ Variabel NOMOR_HP belum diatur di Railway!");
                return;
            }
            try {
                console.log(`Meminta kode pairing untuk nomor: ${phoneNumber}...`);
                let code = await sock.requestPairingCode(phoneNumber.trim());
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 KODE PAIRING KAMU: ${code}\n`);
            } catch (err) {
                console.error('❌ Gagal meminta kode pairing:', err);
            }
        }, 5000);
    }

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;
            
            const mtype = Object.keys(msg.message)[0];
            let body = '';
            
            if (mtype === 'conversation') {
                body = msg.message.conversation;
            } else if (mtype === 'extendedTextMessage') {
                body = msg.message.extendedTextMessage.text;
            } else if (mtype === 'imageMessage' && msg.message.imageMessage.caption) {
                body = msg.message.imageMessage.caption;
            }

            const from = msg.key.remoteJid;
            console.log(`📩 Pesan dari ${from}: "${body}"`);

            if (!body) continue;
            const text = body.trim();
            const lowerText = text.toLowerCase();

            if (lowerText === '.ping') {
                await sock.sendMessage(from, { text: '🏓 Pong! Bot Jefri responsif & stabil!' }, { quoted: msg });
                continue;
            }

            if (lowerText.startsWith('.ai')) {
                const prompt = text.slice(3).trim();
                if (!prompt) {
                    await sock.sendMessage(from, { text: '⚠️ Masukkan pertanyaannya! Contoh: `.ai Halo`' }, { quoted: msg });
                    continue;
                }

                const apiKey = process.env.GROQ_API_KEY;
                if (!apiKey) {
                    await sock.sendMessage(from, { text: '❌ GROQ_API_KEY belum diatur di Variables Railway!' }, { quoted: msg });
                    continue;
                }

                await sock.presenceSubscribe(from);
                await sock.sendPresenceUpdate('composing', from);

                try {
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: 'Kamu adalah Jefri, asisten WhatsApp yang cerdas, humoris, asik, dan gaul.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.7
                        })
                    });

                    const data = await response.json();
                    const replyText = data.choices?.[0]?.message?.content || 'Maaf, gagal mendapatkan respons.';
                    await sock.sendMessage(from, { text: replyText }, { quoted: msg });
                } catch (err) {
                    console.error('❌ Error Groq API:', err);
                    await sock.sendMessage(from, { text: '❌ Gagal menghubungi server Groq AI.' }, { quoted: msg });
                }
            }
        }
    });
}

startBot();
