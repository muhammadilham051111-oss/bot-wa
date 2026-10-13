console.log("LOG: Bot starting with SESSION_DATA support...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function startBot() {
    // Jika ada SESSION_DATA di environment variables, restore ke auth_temp
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
            console.log('\n✅ BOT JEFRI BERHASIL TERHUBUNG SEPENUHNYA!\n');
        }
    });

    // Jika belum ada creds yang terdaftar dan tidak ada SESSION_DATA, baru minta pairing code
    if (!sock.authState.creds.registered && !process.env.SESSION_DATA) {
        setTimeout(async () => {
            const phoneNumber = process.env.NOMOR_HP;
            if (!phoneNumber) {
                console.error('❌ NOMOR_HP belum diatur di Variables Railway!');
                return;
            }
            try {
                console.log("LOG: Meminta kode pairing untuk:", phoneNumber.trim());
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
