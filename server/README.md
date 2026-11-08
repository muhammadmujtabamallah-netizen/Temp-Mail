# 2Sec Mail — Apna Khud Ka Temp Mail Server

Ye tumhara **apna temp-mail server** hai: real email receive karta hai (SMTP),
REST API deta hai, aur web inbox serve karta hai. Iske baad tumhe kisi
teesri service (Guerrilla / Ninja / mail123 / 1secmail) ki zaroorat nahi.

## Chalane ke liye 2 cheezein chahiye (ye paise wali hain)

### 1. Ek domain naam (lagbhag $10–15 / saal)
Jaise `gmaill123.com` — kisi registrar se khareedna padega:
Namecheap, Cloudflare Registrar ya GoDaddy se. Domain khareede baghair
us naam pe email kabhi receive nahi ho sakta — ye sabse zaroori step hai.

### 2. Ek VPS / server jo 24 ghante chale
- Sasta: Hetzner / Contabo / DigitalOcean — lagbhag **$4–6 / mahina**, Ubuntu.
- Free: Oracle Cloud "Always Free" VPS (card verification mangta hai).
- Server pe Node.js 18+ hona chahiye.

> Bina domain aur VPS ke ye code kahin "chal" nahi sakta — ye code hai,
> server nahi. Domain + VPS milte hi neeche wale steps se 10 minute me
> live ho jayega.

## VPS pe setup (Ubuntu)

```bash
# 1. Node.js install karo
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Code lao
git clone https://github.com/muhammadmujtabamallah-netizen/Temp-Mail.git
cd Temp-Mail/server
npm install

# 3. Apni domain set karo
cp .env.example .env
nano .env        # MAIL_DOMAIN=gmaill123.com likho

# 4. Chalao (PM2 se hamesha chalta rahega)
sudo npm install -g pm2
pm2 start server.js --name 2secmail
pm2 save
```

## DNS setting (domain registrar pe)

| Type | Name | Value |
|------|------|-------|
| A | @ | tumhare VPS ka IP address |
| MX | @ | tumhari domain (jaise `gmaill123.com`) — Priority 10 |

## Firewall (VPS pe)

- Port **25** (SMTP — email receive karne ke liye) — khula hona chahiye.
  Kuch providers port 25 block karte hain — unse unblock karwana padega.
- Port **5000** (website + API) — ya Nginx se port 80 pe proxy kar lo.

## Hosting files (one-click deploy)

- `Dockerfile` — `docker build -t 2secmail . && docker run -p 5000:5000 -p 25:25 2secmail`
- `docker-compose.yml` — `docker compose up -d` (VPS pe)
- `render.yaml` — Render.com pe Blueprint deploy (sirf website + API online hogi)

> Dhyaan do: Render / Netlify / Vercel jaise free hosts **port 25 nahi dete**,
> isliye wahan website to online ho jayegi lekin **real email nahi ayega**.
> Email receive karne ke liye VPS hi chahiye (port 25 ke saath).

## Kya milega

- Website: `http://tumhari-domain:5000/` (ya Nginx ke saath `https://tumhari-domain/`)
- Email: `kuch-bhi@tumhari-domain` — jo bhi naam banao, inbox me ayega.
- API: mail123 jaisi hi — `/api/v1/mailbox/new`, `/api/v1/mailbox/{address}/messages`

## Test (apne computer pe, bina domain ke)

```bash
cd server
npm install
MAIL_DOMAIN=test.local HTTP_PORT=5000 SMTP_PORT=2525 node server.js
# Doosri terminal me test mail bhejo:
node -e "const n=require('nodemailer');(async()=>{let t=n.createTransport({host:'127.0.0.1',port:2525,secure:false,tls:{rejectUnauthorized:false}});await t.sendMail({from:'a@b.com',to:'hello@test.local',subject:'Test 123456',text:'code 123456'});console.log('sent')})()"
curl http://127.0.0.1:5000/api/v1/mailbox/hello@test.local/messages
```

## Files

- `server.js` — SMTP receiver + REST API + static site
- `public/index.html` — web inbox (API base relative `/api/v1/`)
- `package.json` — dependencies (express, smtp-server, mailparser)
- `.env.example` — settings ka sample
