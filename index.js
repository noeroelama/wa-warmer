import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import conversationCorpus from "./conversation.js";

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

async function startWhatsAppClient(sessionPath, baileysComponents) {
  const { makeWASocket, useMultiFileAuthState, DisconnectReason } =
    baileysComponents;

  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      // --- FIX 1: Updated the browser version to be modern and varied ---
      browser: ["ChatWarmer", "Chrome", "20.0.04"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("QR code received, please scan:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        console.log(
          `Connection opened successfully for session: ${sessionPath}`
        );
        resolve(sock);
      } else if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log(
          `Connection for ${sessionPath} closed due to:`,
          lastDisconnect.error,
          ", reconnecting:",
          shouldReconnect
        );
        if (shouldReconnect) {
          // --- FIX 2: Passed the baileysComponents argument during reconnect ---
          startWhatsAppClient(sessionPath, baileysComponents)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error("Connection closed and cannot reconnect."));
        }
      }
    });
  });
}

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
    console.log(
      `[${senderSock.user.id}] Sending: "${message}" to ${receiverJid}`
    );
    await senderSock.sendPresenceUpdate("composing", receiverJid);
    await new Promise((resolve) => setTimeout(resolve, randomShortDelay(2, 4)));
    await senderSock.sendMessage(receiverJid, { text: message });
    turn = turn === "A" ? "B" : "A";
  }

  // Renamed 'jid' parameter to 'receiverJid' for better clarity
  async function handleMessageReply(sock, msg, receiverJid) {
    await new Promise((resolve) => setTimeout(resolve, randomShortDelay(1, 3)));
    await sock.readMessages([msg.key]);

    if (Math.random() < 0.4) {
      await new Promise((resolve) =>
        setTimeout(resolve, randomShortDelay(1, 2))
      );
      const randomEmoji =
        reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
      console.log(`[${sock.user.id}] Reacting with: ${randomEmoji}`);
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

  setTimeout(() => {
    if (turn === "A" && conversationIndex < conversationCorpus.length) {
      sendMessage(sockA, jidB, conversationCorpus[conversationIndex]);
      conversationIndex++;
    }
  }, 10000);

  sockA.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe || msg.key.remoteJid !== jidB) return;
    if (turn === "A") {
      await handleMessageReply(sockA, msg, jidB);
    }
  });

  sockB.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe || msg.key.remoteJid !== jidA) return;
    if (turn === "B") {
      await handleMessageReply(sockB, msg, jidA);
    }
  });
}

main().catch((err) => console.error("An error occurred:", err));
