console.log("LOG: Bot starting with clean disconnect handler...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function startBot() {
    if (process.env.SESSION_DATA) {
        if (!fs.existsSync('./auth_temp')) {
            fs.mkdirSync('./auth_temp', { recursive: true });
        }
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
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`LOG: Koneksi tertutup (Status Code: ${statusCode})`);

            // Jika error 440 atau terputus biasa, lakukan reconnect dengan aman tanpa crash kontainer
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => {
                    startBot();
                }, 5000);
            } else {
                console.log("❌ Perangkat terputus (Logged Out).");
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT JEFRI DENGAN GROQ AI BERHASIL TERHUBUNG SEPENUHNYA!\n');
        }
    });

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

            if (body.toLowerCase() === '.ping') {
                await sock.sendMessage(from, { text: 'Pong! 🏓 Bot Jefri & Groq AI aktif dan stabil!' }, { quoted: msg });
                continue;
            }

            if (body.toLowerCase().startsWith('.ai')) {
                const prompt = body.slice(3).trim();
                if (!prompt) {
                    await sock.sendMessage(from, { text: '⚠️ Masukkan pertanyaannya, contoh: `.ai Halo siapa kamu?`' }, { quoted: msg });
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
                                { role: 'system', content: 'Kamu adalah Jefri, asisten WhatsApp yang ramah, santai, dan membantu.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.7
                        })
                    });

                    const data = await response.json();
                    const replyText = data.choices?.[0]?.message?.content || 'Maaf, gagal mendapatkan respons dari Groq AI.';

                    await sock.sendMessage(from, { text: replyText }, { quoted: msg });

                } catch (err) {
                    console.error('❌ Error Groq API:', err);
                    await sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat menghubungi server Groq AI.' }, { quoted: msg });
                }
            }
        }
    });
}

startBot();
