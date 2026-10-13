console.log("LOG: Bot baru dari nol dimulai...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

if (fs.existsSync('./auth_temp')) {
    fs.rmSync('./auth_temp', { recursive: true, force: true });
}

async function startBot() {
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
            }
        } else if (connection === 'open') {
            console.log('\n✅ BERHASIL TERHUBUNG!\n');
            try {
                const credsData = fs.readFileSync('./auth_temp/creds.json', 'utf-8');
                const base64Data = Buffer.from(JSON.stringify({ creds: JSON.parse(credsData), keys: {} })).toString('base64');
                console.log('================= SESSION DATA =================\n');
                console.log(base64Data);
                console.log('\n================================================\n');
            } catch (e) {
                console.error('Gagal baca creds:', e);
            }
        }
    });

    setTimeout(async () => {
        if (!sock.authState.creds.registered) {
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
        }
    }, 5000);
}

startBot();
