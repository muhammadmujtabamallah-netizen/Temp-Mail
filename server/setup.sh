#!/bin/bash
# 2Sec Mail — one-command VPS setup (Ubuntu / Debian)
# Usage on a fresh VPS:
#   MAIL_DOMAIN=tumhari-domain.com bash setup.sh
# Or directly from GitHub:
#   MAIL_DOMAIN=tumhari-domain.com bash <(curl -s https://raw.githubusercontent.com/muhammadmujtabamallah-netizen/Temp-Mail/main/server/setup.sh)
set -e
DOMAIN="${MAIL_DOMAIN:-example.com}"
echo "==> 2Sec Mail setup — domain: $DOMAIN"
echo "==> Installing Node.js 20 ..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
echo "==> Getting code ..."
if [ -d Temp-Mail ]; then
  cd Temp-Mail && git pull
else
  git clone https://github.com/muhammadmujtabamallah-netizen/Temp-Mail.git
  cd Temp-Mail
fi
cd server
npm install --omit=dev
echo "==> Config ..."
printf 'MAIL_DOMAIN=%s\nHTTP_PORT=5000\nSMTP_PORT=25\n' "$DOMAIN" > .env
echo "==> Firewall (allow 25 + 5000) ..."
sudo ufw allow 25/tcp || true
sudo ufw allow 5000/tcp || true
sudo ufw --force enable || true
echo "==> Starting with PM2 ..."
sudo npm install -g pm2
pm2 start server.js --name 2secmail || pm2 restart 2secmail
pm2 save
IP=$(curl -s ifconfig.me || echo YOUR-VPS-IP)
echo "==> DONE!"
echo "    Website: http://$IP:5000/"
echo "    Email domain: $DOMAIN (apne registrar pe MX record lagana mat bhoolo)"
