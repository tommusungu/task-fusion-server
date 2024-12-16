const express = require("express");
const Imap = require("node-imap");
const inspect = require("util").inspect;
const cors = require("cors"); // Import cors
require("dotenv").config();

const app = express();
const PORT = 3000; // Use a port of your choice

// Use cors middleware
app.use(cors());

function isPrintable(str) {
  return /^[\x20-\x7E\s]*$/.test(str);
}

app.get("/api/emails", (req, res) => {
  let imap = new Imap({
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_PASSWORD,
    host: "imap.gmail.com",
    port: 993,
    tls: true
  });

  function openInbox(cb) {
    imap.openBox("INBOX", true, cb);
  }

  let emails = [];

  imap.once("ready", function () {
    openInbox(function (err, box) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to open inbox" });
        return;
      }

      let f = imap.seq.fetch(`${box.messages.total - 10}:${box.messages.total}`, {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "1"],
        struct: true
      });

      f.on("message", function (msg, seqno) {
        let email = { seqno, headers: {}, body: "" };

        msg.on("body", function (stream, info) {
          let buffer = "";
          stream.on("data", (chunk) => (buffer += chunk.toString("utf8")));
          stream.once("end", () => {
            if (info.which === "1") {
              let decodedBody = Buffer.from(buffer, "base64").toString("utf8");
              email.body = isPrintable(decodedBody) ? decodedBody : buffer;
            } else {
              email.headers = Imap.parseHeader(buffer);
            }
          });
        });

        msg.once("attributes", (attrs) => {
          email.attributes = attrs;
        });

        msg.once("end", () => {
          emails.push(email);
        });
      });

      f.once("end", () => {
        imap.end();
        res.json(emails);
      });

      f.once("error", (err) => {
        console.error("Fetch error:", err);
        res.status(500).json({ error: "Failed to fetch emails" });
      });
    });
  });

  imap.once("error", (err) => {
    console.error("IMAP connection error:", err);
    res.status(500).json({ error: "IMAP connection error" });
  });

  imap.once("end", () => console.log("Connection ended"));

  imap.connect();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
