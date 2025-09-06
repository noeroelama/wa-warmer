# WhatsApp Account Warmer

A simple Node.js script designed to "warm up" new WhatsApp numbers by automating a natural, human-like conversation between two accounts. This helps build trust for the numbers before using them in larger operations.

## Features

- **Automated Two-Way Conversation**: Simulates a full back-and-forth chat based on a predefined script.
- **Dynamic Number Setup**: No need to hardcode phone numbers. Just scan the QR code to log in.
- **Human-like Behavior Simulation**:
  - Random delays between actions (reading, reacting, replying).
  - Shows "composing..." status before sending a message.
  - Marks incoming messages as read (generating blue ticks).
  - Sends random emoji reactions to some messages to appear more natural.
- **Conversation Looping**: Automatically restarts the conversation after a long, random break, allowing the script to run for days.
- **Automatic Reconnection**: If the connection drops, the script will attempt to reconnect automatically.
- **Clean & Modular**: The conversation script is kept in a separate `conversation.js` file for easy editing.

## Prerequisites

Make sure you have Node.js installed on your system (v18.x or higher is recommended).

## 🚀 Setup & Installation

1.  **Clone the repository or download the files.**
    ```bash
    git clone https://github.com/noeroelama/wa-warmer.git
    cd wa-warmer
    ```

2.  **Install the dependencies.**
    Open a terminal in the project directory and run:
    ```bash
    npm install
    ```

3.  **Customize the conversation.**
    Open the `conversation.js` file and edit the array of strings to create the conversation you want.

## 📁 File Structure

````

/
├── sessions/         \# Stores login session data for each number
├── conversation.js   \# \<-- Edit your conversation lines here\!
├── index.js          \# The main script logic
└── package.json

````

## ⚙️ Configuration

The main configuration is done in `conversation.js`. Just modify the array to control the chat flow.



## ▶️ How to Run

1.  **Start the script from your terminal:**

    ```bash
    node index.js
    ```

2.  **Scan the first QR code** that appears in the terminal with your first WhatsApp account.

3.  **Wait for the first account to connect.** The terminal will confirm it. Then, a second QR code will appear.

4.  **Scan the second QR code** with your second WhatsApp account.

5.  Once both are connected, the script will wait a few seconds and then begin the conversation automatically. Let it run in the background.

## ⚠️ Disclaimer

This script uses an unofficial WhatsApp API (@whiskeysockets/baileys). Using it carries an inherent risk of your numbers being blocked or banned by WhatsApp, especially if not used carefully. This tool is intended for educational and experimental purposes.

The author is not responsible for any consequences of its use. **Use it at your own risk and be smart about it.**