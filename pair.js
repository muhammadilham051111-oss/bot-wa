const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");

async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_temp");
    const nomorHp = process.env.NOMOR_HP;
    if (!nomorHp) {
        console.log("LOG: Masukkan nomor HP dengan format NOMOR_HP=628xxx node pair.js");
        process.exit(1);
    }
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.04.0"]
    });
    sock.ev.on("creds.update", saveCreds);
    if (!sock.authState.creds.registered) {
        console.log("LOG: Starting Jefri Bot with stable Ubuntu browser identity...");
        console.log("LOG: Status Koneksi: connecting");
        console.log("Meminta kode pairing untuk nomor: " + nomorHp + "...");
        await delay(3000);
        const code = await sock.requestPairingCode(nomorHp);
        console.log("\n🔑 KODE PAIRING KAMU: " + code + "\n");
    }
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("LOG: Status Koneksi: open");
            console.log("\n================ SESSION_DATA BARU ================");
            const credsData = fs.readFileSync("./auth_temp/creds.json");
            console.log(credsData.toString("base64"));
            console.log("====================================================\n");
            fs.rmSync("./auth_temp", { recursive: true, force: true });
            process.exit(0);
        } else if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log("LOG: Status Koneksi: close (Status Code: " + statusCode + ")");
        }
    });
}
startPairing();
