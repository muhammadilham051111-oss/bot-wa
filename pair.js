console.log("LOG: Starting fresh pairing session generator...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function startPairingBot() {
    // Hapus sesi lama yang korup agar benar-benar fresh
    if (fs.existsSync('./auth_temp')) {
        fs.rmSync('./auth_temp', { recursive: true, force: true });
        console.log("LOG: Sesi lama berhasil dibersihkan.");
    }
    fs.mkdirSync('./auth_temp', { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState('./auth_temp');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.ubuntu('Chrome')
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
            if (statusCode === DisconnectReason.loggedOut) {
                console.log("❌ Perangkat terkeluar (Logged out). Silakan restart deployment.");
            }
        } else if (connection === 'open') {
            console.log('\n✅ BERHASIL TERHUBUNG! Sesi baru siap digunakan.\n');
            
            // Konversi creds.json ke Base64 untuk SESSION_DATA baru
            try {
                if (fs.existsSync('./auth_temp/creds.json')) {
                    const credsFile = fs.readFileSync('./auth_temp/creds.json', 'utf-8');
                    const base64Data = Buffer.from(JSON.stringify({ creds: JSON.parse(credsFile) })).toString('base64');
                    console.log("\n================== SESSION_DATA BARU ==================");
                    console.log(base64Data);
                    console.log("=======================================================\n");
                    console.log("Salin teks Base64 di atas dan perbarui variabel SESSION_DATA di Railway kamu!");
                }
            } catch (err) {
                console.error("Gagal generate Base64 SESSION_DATA:", err);
            }
        }
    });

    // Minta kode pairing setelah beberapa detik jika belum terdaftar
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const phoneNumber = process.env.NOMOR_HP;
            if (!phoneNumber) {
                console.log("⚠️ Variabel NOMOR_HP belum diatur di Railway! Masukkan nomor WhatsApp kamu di Variables.");
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
        }, 6000);
    }
}

startPairingBot();
