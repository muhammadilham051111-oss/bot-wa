const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const P = require('pino');

const MONGODB_URI = "mongodb+srv://muhammadilham:jefribotnew@cluster0.o1fagsh.mongodb.net/?appName=Cluster0&tls=true&retryWrites=true";

async function startBot() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('whatsapp_bot');
    const col = db.collection('sessions');

    console.log('✅ Terhubung ke MongoDB Atlas!');

    // Simulasi auth state sederhana dari MongoDB
    const credsDoc = await col.findOne({ filename: 'creds.json' });
    let creds = credsDoc ? JSON.parse(credsDoc.data) : undefined;

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const doc = await col.findOne({ filename: `${type}-${id}.json` });
                        if (doc) data[id] = JSON.parse(doc.data);
                    }
                    return data;
                },
                set: async (data) => {
                    for (const type of Object.keys(data)) {
                        for (const id of Object.keys(data[type])) {
                            const value = data[type][id];
                            const filename = `${type}-${id}.json`;
                            if (value) {
                                await col.updateOne({ filename }, { $set: { filename, data: JSON.stringify(value) } }, { upsert: true });
                            } else {
                                await col.deleteOne({ filename });
                            }
                        }
                    }
                }
            }
        }
    });

    // Simpan kredensial saat ada pembaruan
    sock.ev.on('creds.update', async () => {
        await col.updateOne(
            { filename: 'creds.json' },
            { $set: { filename: 'creds.json', data: JSON.stringify(sock.authState.creds) } },
            { upsert: true }
        );
    });

    // Penanganan Koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('🚀 BOT WHATSAPP BERHASIL TERHUBUNG!');
        }
    });

    // Penanganan Pesan Masuk (Aman dari Looping & Mendukung Pesan Sendiri)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        // Ambil teks pesan dari berbagai jenis format pesan WhatsApp
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     '';

        // Cek perintah !ping (aman dipicu dari nomor sendiri maupun orang lain)
        if (body.trim() === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'Pong! ⚡ Bot aktif menggunakan MongoDB Atlas!' 
            }, { quoted: msg });
        }
    });
}

startBot();
