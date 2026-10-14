const { default: makeWASocket, initAuthCreds, DisconnectReason } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const P = require('pino');

const MONGODB_URI = "mongodb+srv://muhammadilham:jefribotnew@cluster0.o1fagsh.mongodb.net/whatsapp_bot?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true";

async function startBot() {
    const client = new MongoClient(MONGODB_URI);

    await client.connect();
    const db = client.db('whatsapp_bot');
    const col = db.collection('sessions');

    console.log('✅ Terhubung ke MongoDB Atlas!');

    // Ambil sesi creds dari MongoDB
    let creds;
    try {
        const credsDoc = await col.findOne({ filename: 'creds.json' });
        if (credsDoc && credsDoc.data) {
            creds = JSON.parse(credsDoc.data);
        } else {
            creds = initAuthCreds();
        }
    } catch (e) {
        console.log('⚠️ Sesi creds.json tidak terbaca, inisialisasi ulang...');
        creds = initAuthCreds();
    }

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: {
            creds: creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        try {
                            const doc = await col.findOne({ filename: `${type}-${id}.json` });
                            if (doc && doc.data) {
                                data[id] = JSON.parse(doc.data);
                            }
                        } catch (err) {
                            // Abaikan error kunci individual jika tidak ada
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    for (const type of Object.keys(data)) {
                        for (const id of Object.keys(data[type])) {
                            const value = data[type][id];
                            const filename = `${type}-${id}.json`;
                            if (value) {
                                await col.updateOne(
                                    { filename }, 
                                    { $set: { filename, data: JSON.stringify(value) } }, 
                                    { upsert: true }
                                );
                            } else {
                                await col.deleteOne({ filename });
                            }
                        }
                    }
                }
            }
        }
    });

    sock.ev.on('creds.update', async () => {
        await col.updateOne(
            { filename: 'creds.json' },
            { $set: { filename: 'creds.json', data: JSON.stringify(sock.authState.creds) } },
            { upsert: true }
        );
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Scan QR Code berikut jika diminta koneksi baru:');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Koneksi terputus (Status Code: ${statusCode}). Mencoba menghubungkan kembali dalam 5 detik...`);
            
            // Tutup koneksi DB & Socket lama agar tidak bentrok
            try { await client.close(); } catch(e) {}
            
            if (shouldReconnect) {
                setTimeout(() => {
                    startBot();
                }, 5000);
            }
        } else if (connection === 'open') {
            console.log('🚀 BOT WHATSAPP BERHASIL TERHUBUNG!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     '';

        if (body.trim() === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'Pong! ⚡ Bot aktif menggunakan MongoDB Atlas!' 
            }, { quoted: msg });
        }
    });
}

startBot();
