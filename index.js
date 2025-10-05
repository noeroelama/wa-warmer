import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import conversationCorpus from "./conversation.js";

// --- KONSTANTA DAN HELPER ---
const reactionEmojis = ["👍", "😂", "❤️", "😮", "🙏", "😊"];

function randomShortDelay(min = 5, max = 15) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

function randomLongDelay(minMinutes = 5, maxMinutes = 10) {
  const minutes = Math.floor(
    Math.random() * (maxMinutes - minMinutes + 1) + minMinutes
  );
  console.log(
    `\nConversation loop finished. Waiting for ${minutes} minutes before restarting...\n`
  );
  return minutes * 60 * 1000;
}

// --- FUNGSI UTAMA KLIEN WHATSAPP ---
async function startWhatsAppClient(sessionPath, baileysComponents) {
  const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
  } = baileysComponents;

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS("Chrome"),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log(`QR code for ${sessionPath}, please scan:`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(
        `Connection for ${sessionPath} closed. Reconnecting: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        startWhatsAppClient(sessionPath, baileysComponents);
      }
    } else if (connection === "open") {
      console.log(`Connection opened successfully for session: ${sessionPath}`);
    }
  });

  return new Promise((resolve, reject) => {
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        resolve(sock);
      } else if (connection === "close") {
        if (
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          // Biarkan logika rekoneksi berjalan
        } else {
          reject(
            new Error("Connection closed permanently. Please re-scan QR.")
          );
        }
      }
    });
  });
}

// --- LOGIKA UTAMA APLIKASI ---
async function main() {
  const baileys = await import("@whiskeysockets/baileys");
  const { jidNormalizedUser } = baileys;

  console.log("--- Initializing First Client (Number A) ---");
  const sockA = await startWhatsAppClient("sessions/number_a", baileys);
  const jidA = jidNormalizedUser(sockA.user.id);
  console.log(`>>> First client connected as: ${jidA}\n`);

  console.log("--- Initializing Second Client (Number B) ---");
  const sockB = await startWhatsAppClient("sessions/number_b", baileys);
  const jidB = jidNormalizedUser(sockB.user.id);
  console.log(`>>> Second client connected as: ${jidB}\n`);

  console.log("Both clients connected. Starting conversation logic...");

  let conversationIndex = 0;
  let turn = "A";

  async function sendMessage(senderSock, receiverJid, message) {
    console.log(`[${senderSock.user.id.split(":")[0]}] Sending: "${message}"`);
    await senderSock.sendPresenceUpdate("composing", receiverJid);
    await new Promise((resolve) => setTimeout(resolve, randomShortDelay(2, 4)));
    await senderSock.sendMessage(receiverJid, { text: message });
    turn = turn === "A" ? "B" : "A";
  }

  async function handleMessageReply(sock, msg, receiverJid) {
    await new Promise((resolve) => setTimeout(resolve, randomShortDelay(1, 3)));
    await sock.readMessages([msg.key]);

    if (Math.random() < 0.4) {
      await new Promise((resolve) =>
        setTimeout(resolve, randomShortDelay(1, 2))
      );
      const randomEmoji =
        reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
      console.log(
        `[${sock.user.id.split(":")[0]}] Reacting with: ${randomEmoji}`
      );
      await sock.sendMessage(receiverJid, {
        react: { text: randomEmoji, key: msg.key },
      });
    }

    if (conversationIndex < conversationCorpus.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, randomShortDelay(3, 8))
      );
      sendMessage(sock, receiverJid, conversationCorpus[conversationIndex]);
      conversationIndex++;
    } else {
      setTimeout(() => {
        conversationIndex = 0;
        turn = "A";
        console.log("\n--- RESTARTING CONVERSATION LOOP ---\n");
        sendMessage(sockA, jidB, conversationCorpus[conversationIndex]);
        conversationIndex++;
      }, randomLongDelay());
    }
  }

  function createMessageHandler(sock, expectedTurn, targetJid) {
    return async function ({ messages }) {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe || msg.key.remoteJid !== targetJid) {
        return;
      }

      if (turn === expectedTurn) {
        console.log(
          `[${sock.user.id.split(":")[0]}] Received: "${
            msg.message?.conversation || msg.message?.extendedTextMessage?.text
          }"`
        );
        await handleMessageReply(sock, msg, targetJid);
      }
    };
  }

  // ==========================================================
  // INI BAGIAN YANG DIPERBAIKI
  // ==========================================================
  // sockA akan membalas HANYA JIKA giliran ("turn") adalah 'A'
  sockA.ev.on("messages.upsert", createMessageHandler(sockA, "A", jidB));

  // sockB akan membalas HANYA JIKA giliran ("turn") adalah 'B'
  sockB.ev.on("messages.upsert", createMessageHandler(sockB, "B", jidA));
  // ==========================================================

  setTimeout(() => {
    if (turn === "A" && conversationIndex < conversationCorpus.length) {
      sendMessage(sockA, jidB, conversationCorpus[conversationIndex]);
      conversationIndex++;
    }
  }, 10000);
}

main().catch((err) => console.error("An error occurred in main process:", err));
