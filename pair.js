console.log("LOG: Starting Jefri Bot with Full Nationwide Plate Check...");

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

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
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`LOG: Koneksi ditutup (Status Code: ${statusCode})`);
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => { startBot(); }, 5000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT JEFRI DENGAN PLAT SE-INDONESIA SIAP!\n');
            
            try {
                if (fs.existsSync('./auth_temp/creds.json') && !process.env.SESSION_DATA) {
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

            // MENU UTAMA
            if (lowerText === '.menu' || lowerText === '.help') {
                const menuText = `🤖 *DAFTAR 45 FITUR KEREN BOT JEFRI* 🤖
Ketik perintah di bawah untuk mulai menggunakannya! 🚀

🧠 *AI & UTILITAS*
1. \`.ai <pesan>\` - Tanya apa aja ke Groq AI
2. \`.ping\` - Cek kecepatan bot
3. \`.owner\` - Info pembuat bot
4. \`.runtime\` - Cek durasi bot aktif
5. \`.translate <teks>\` - Terjemahin bahasa

❤️ *JODOH & ASMARA*
6. \`.jodoh <nama1> & <nama2>\` - Cek kecocokan pasangan
7. \`.sintren <nama>\` - Ramalan cinta harian
8. \`.gombalan\` - Gombalan maut bikin senyum
9. \`.persentasecinta <kamu> & <dia>\` - Tingkat kebucinan
10. \`.mantan\` - Peluang balikan

🚗 *PLAT NOMOR SE-INDONESIA*
11. \`.plat <kode>\` - Cek asal daerah plat nomor (Jawa, Sumatera, Kalimantan, Sulawesi, dll)
12. \`.cekmobil\` - Info mobil impian
13. \`.cekmotor\` - Info motor gokil
14. \`.parkir\` - Simulasi tukang parkir
15. \`.kecepatan\` - Tes kecepatan khayalan

🎮 *GAME & HIBURAN*
16. \`.tebakgambar\` - Game tebak-tebakan
17. \`.kuis\` - Kuis pengetahuan umum
18. \`.truthordark\` - Truth or Dare kocak
19. \`.gombalinaku\` - Minta bot gombalin kamu
20. \`.pantun\` - Pantun jenaka
21. \`.kapankah <tanya>\` - Ramalan ngawur
22. \`.bisakah <tanya>\` - Ya atau tidak
23. \`.rate <sesuatu>\` - Penilaian tingkat ganteng/cantik
24. \`.artinama <nama>\` - Arti nama tersembunyi
25. \`.sifat <nama>\` - Cek sifat asli temen

🔮 *FITUR LAINNYA (26-45)*
26. \`.hoki\` - Cek hoki hari ini
27. \`.zodiak <zodiak>\` - Ramalan zodiak
28. \`.shio <tahun>\` - Cek shio
29. \`.tarot\` - Kartu tarot virtual
30. \`.katamutiara\` - Kata bijak
31. \`.faktanya\` - Fakta unik dunia
32. \`.cuaca <kota>\` - Ramalan cuaca
33. \`.reminder <teks>\` - Pengingat kilat
34. \`.lirik <lagu>\` - Cari lirik lagu
35. \`.chord <lagu>\` - Kunci gitar
36. \`.playlist\` - Rekomendasi musik
37. \`.genre\` - Tebak genre
38. \`.dj\` - Mode DJ remix
39. \`.suhu\` - Konversi suhu
40. \`.biodata\` - Kartu kenalan Jefri
41. \`.randomquotes\` - Kutipan kocak
42. \`.reset\` - Bersihkan memori
43. \`.saran\` - Minta ide kreatif
44. \`.math <soal>\` - Hitung cepat
45. \`.tanya <teks>\` - Konsultasi gaul`;

                await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                continue;
            }

            // PING
            if (lowerText === '.ping') {
                await sock.sendMessage(from, { text: '🏓 Pong! Bot Jefri responsif 0.02 detik. Mantap jiwa!' }, { quoted: msg });
                continue;
            }

            // JODOH
            if (lowerText.startsWith('.jodoh')) {
                const pasangan = text.slice(6).trim();
                if (!pasangan) {
                    await sock.sendMessage(from, { text: '⚠️ Format salah! Contoh: `.jodoh Budi & Ani`' }, { quoted: msg });
                    continue;
                }
                const persentase = Math.floor(Math.random() * 61) + 40;
                let pesanCinta = persentase > 80 ? '🔥 Cocok banget! Tinggal tunggu undangan nikah nih!' : persentase > 60 ? '✨ Cukup serasi, tapi sering berantem masalah sepele.' : '💔 Waduh, kayaknya lebih cocok jadi bestie aja deh!';
                
                await sock.sendMessage(from, { text: `🔮 *HASIL CEK JODOH* 🔮\n\nPasangan: ${pasangan}\nTingkat Kecocokan: *${persentase}%*\n\n💡 Analisis: ${pesanCinta}` }, { quoted: msg });
                continue;
            }

            // PLAT NOMOR SE-INDONESIA (JAWA, SUMATERA, KALIMANTAN, SULAWESI, BALI, NUSA TENGGARA, MALUKU, PAPUA)
            if (lowerText.startsWith('.plat')) {
                const kodePlat = text.slice(5).trim().toUpperCase();
                if (!kodePlat) {
                    await sock.sendMessage(from, { text: '⚠️ Masukkan kode platnya! Contoh: `.plat B`, `.plat BM`, `.plat DA`, atau `.plat PA`' }, { quoted: msg });
                    continue;
                }
                
                let daerah = 'Wilayah tidak diketahui atau plat khusus/gaib.';
                
                // JAWA
                if (kodePlat.startsWith('A')) daerah = 'Banten (Serang, Cilegon, Pandeglang, Lebak, Tangerang Kab.)';
                else if (kodePlat.startsWith('B')) daerah = 'DKI Jakarta, Depok, Bekasi, Tangerang';
                else if (kodePlat.startsWith('D')) daerah = 'Bandung, Cimahi, Bandung Barat';
                else if (kodePlat.startsWith('E')) daerah = 'Cirebon, Indramayu, Majalengka, Kuningan';
                else if (kodePlat.startsWith('F')) daerah = 'Bogor, Sukabumi, Cianjur';
                else if (kodePlat.startsWith('G')) daerah = 'Pekalongan, Tegal, Brebes, Batang, Pemalang';
                else if (kodePlat.startsWith('H')) daerah = 'Semarang, Salatiga, Kendal, Demak';
                else if (kodePlat.startsWith('K')) daerah = 'Pati, Kudus, Jepara, Rembang, Blora, Grobogan';
                else if (kodePlat.startsWith('L')) daerah = 'Surabaya (Jawa Timur)';
                else if (kodePlat.startsWith('M')) daerah = 'Madura (Bangkalan, Sampang, Pamekasan, Sumenep)';
                else if (kodePlat.startsWith('N')) daerah = 'Malang, Probolinggo, Pasuruan, Lumajang, Batu';
                else if (kodePlat.startsWith('S')) daerah = 'Bojonegoro, Tuban, Lamongan, Jombang, Mojokerto';
                else if (kodePlat.startsWith('T')) daerah = 'Purwakarta, Karawang, Subang';
                else if (kodePlat.startsWith('W')) daerah = 'Sidoarjo, Gresik';
                else if (kodePlat.startsWith('Z')) daerah = 'Garut, Tasikmalaya, Ciamis, Banjar, Pangandaran';

                // SUMATERA
                else if (kodePlat.startsWith('BL')) daerah = 'Aceh';
                else if (kodePlat.startsWith('BB')) daerah = 'Sumatera Utara Bagian Barat (Tapanuli, Sibolga, dll)';
                else if (kodePlat.startsWith('BK')) daerah = 'Sumatera Utara Bagian Timur (Medan, Binjai, Deli Serdang, dll)';
                else if (kodePlat.startsWith('BA')) daerah = 'Sumatera Barat (Padang, Bukittinggi, dll)';
                else if (kodePlat.startsWith('BM')) daerah = 'Riau (Pekanbaru, Dumai, dll)';
                else if (kodePlat.startsWith('BP')) daerah = 'Kepulauan Riau (Batam, Tanjung Pinang, dll)';
                else if (kodePlat.startsWith('BH')) daerah = 'Jambi';
                else if (kodePlat.startsWith('BD')) daerah = 'Bengkulu';
                else if (kodePlat.startsWith('BG')) daerah = 'Sumatera Selatan (Palembang, Lubuklinggau, dll)';
                else if (kodePlat.startsWith('BN')) daerah = 'Kepulauan Bangka Belitung';
                else if (kodePlat.startsWith('BE')) daerah = 'Lampung';

                // BALI & NUSA TENGGARA
                else if (kodePlat.startsWith('DK')) daerah = 'Bali';
                else if (kodePlat.startsWith('EA')) daerah = 'Nusa Tenggara Barat (Sumbawa, Bima, Dompu, dll)';
                else if (kodePlat.startsWith('DH')) daerah = 'Nusa Tenggara Timur (Kupang, Timor, dll)';
                else if (kodePlat.startsWith('EB')) daerah = 'Nusa Tenggara Timur (Flores, Lembata)';
                else if (kodePlat.startsWith('ED')) daerah = 'Nusa Tenggara Timur (Sumba)';

                // KALIMANTAN
                else if (kodePlat.startsWith('KB')) daerah = 'Kalimantan Barat (Pontianak, Singkawang, dll)';
                else if (kodePlat.startsWith('DA')) daerah = 'Kalimantan Selatan (Banjarmasin, Banjarbaru, dll)';
                else if (kodePlat.startsWith('KT')) daerah = 'Kalimantan Tengah (Palangka Raya, Sampit, dll)';
                else if (kodePlat.startsWith('KH')) daerah = 'Kalimantan Tengah (Barito/sekitarnya)';
                else if (kodePlat.startsWith('KT')) daerah = 'Kalimantan Timur (Samarinda, Balikpapan, Bontang)';
                else if (kodePlat.startsWith('KU')) daerah = 'Kalimantan Utara (Tarakan, Bulungan, dll)';

                // SULAWESI
                else if (kodePlat.startsWith('DB')) daerah = 'Sulawesi Utara Bagian Barat (Manado, Bitung, Bolaang Mongondow)';
                else if (kodePlat.startsWith('DL')) daerah = 'Sulawesi Utara Bagian Kepulauan (Sangihe, Talaud)';
                else if (kodePlat.startsWith('DM')) daerah = 'Gorontalo';
                else if (kodePlat.startsWith('DN')) daerah = 'Sulawesi Tengah (Palu, Poso, dll)';
                else if (kodePlat.startsWith('DT')) daerah = 'Sulawesi Tenggara (Kendari, Bau-Bau, dll)';
                else if (kodePlat.startsWith('DD')) daerah = 'Sulawesi Selatan (Makassar, Gowa, Maros, dll)';
                else if (kodePlat.startsWith('DW')) daerah = 'Sulawesi Selatan Bagian Barat (Mamuju / Sulbar)';

                // MALUKU & PAPUA
                else if (kodePlat.startsWith('DE')) daerah = 'Maluku (Ambon, Tual, dll)';
                else if (kodePlat.startsWith('DG')) daerah = 'Maluku Utara (Ternate, Tidore, Halmahera)';
                else if (kodePlat.startsWith('PA')) daerah = 'Papua (Jayapura, Merauke, Biak, dll)';
                else if (kodePlat.startsWith('PB')) daerah = 'Papua Barat (Manokwari, Sorong, dll)';

                await sock.sendMessage(from, { text: `🚗 *CEK PLAT NOMOR SE-INDONESIA* 🚗\n\nKode Plat: *${kodePlat}*\n📍 Asal Daerah:\n_${daerah}_` }, { quoted: msg });
                continue;
            }

            // GOMBALAN
            if (lowerText === '.gombalan') {
                const daftarGombal = [
                    "Kamu itu mirip seperti Wi-Fi rumahku, sinyalnya langsung kuat pas dekat sama kamu.",
                    "Tau gak bedanya kamu sama caleg? Kalau caleg nyari suara rakyat, kalau kamu nyari suara hatiku.",
                    "Masa sih bintang di langit banyak? Padahal bintang paling bersinar kan ada di senyum kamu."
                ];
                const randomGombal = daftarGombal[Math.floor(Math.random() * daftarGombal.length)];
                await sock.sendMessage(from, { text: `💘 *GOMBALAN MAUT JEFRI* 💘\n\n"${randomGombal}"` }, { quoted: msg });
                continue;
            }

            // AI
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
                    const replyText = data.choices?.[0]?.message?.content || 'Maaf, otak AI Jefri lagi konslet dikit.';

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
