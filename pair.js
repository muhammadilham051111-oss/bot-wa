console.log("LOG: Bot starting with Groq AI integration...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function startBot() {
    // Restore sesi dari SESSION_DATA jika ada
    if (process.env.SESSION_DATA) {
        if (!fs.existsSync('./auth_temp')) {
            fs.mkdirSync('./auth_temp', { recursive: true });
        }
        try {
            const decodedData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8'));
            if (decodedData.creds) {
                fs.writeFileSync('./auth_temp/creds.json', JSON.stringify(decodedData.creds, null, 2));
                console.log("LOG: Berhasil memuat sesi dari SESSION_DATA variabel.");
            }
        } catch (e) {
            console.error("❌ Gagal memparsing SESSION_DATA:", e);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_temp');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        console.log("LOG: Status Koneksi:", connection);

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            } else {
                console.log("❌ Perangkat terputus/Logged Out.");
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT JEFRI DENGAN GROQ AI BERHASIL TERHUBUNG!\n');
        }
    });

    // Mendengarkan pesan masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) return;
            
            const body = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;

            // Jangan merespons pesan dari bot sendiri
            if (msg.key.fromMe) return;

            console.log(`📩 Pesan masuk dari ${from}: ${body}`);

            // Perintah .ping
            if (body.toLowerCase() === '.ping') {
                await sock.sendMessage(from, { text: 'Pong! 🏓 Bot Jefri & Groq AI aktif!' }, { quoted: msg });
                return;
            }

            // Fitur Groq AI (Aktif jika pesan diawali dengan .ai atau prefix tanya, atau otomatis merespons)
            // Di sini kita buat trigger prefix `.ai <pesan>` atau merespons semua chat jika di chat pribadi
            if (body.startsWith('.ai ')) {
                const prompt = body.slice(4).trim();
                if (!prompt) {
                    await sock.sendMessage(from, { text: '⚠️ Masukkan pertanyaannya, contoh: `.ai Halo siapa kamu?`' }, { quoted: msg });
                    return;
                }

                // Kirim indikator sedang mengetik
                await sock.presenceSubscribe(from);
                await sock.sendPresenceUpdate('composing', from);

                try {
                    const apiKey = process.env.GROQ_API_KEY;
                    if (!apiKey) {
                        await sock.sendMessage(from, { text: '❌ GROQ_API_KEY belum diatur di Variables Railway!' }, { quoted: msg });
                        return;
                    }

                    // Request ke Groq API menggunakan native fetch Node.js
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile', // Model cepat dan pintar dari Groq
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

    if (!sock.authState.creds.registered && !process.env.SESSION_DATA) {
        setTimeout(async () => {
            const phoneNumber = process.env.NOMOR_HP;
            if (!phoneNumber) return;
            try {
                let code = await sock.requestPairingCode(phoneNumber.trim());
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 KODE PAIRING KAMU: ${code}\n`);
            } catch (err) {
                console.error('❌ Gagal minta kode pairing:', err);
            }
        }, 5000);
    }
}

startBot();
