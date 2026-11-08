FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 5000 25
ENV HTTP_PORT=5000 SMTP_PORT=25
CMD ["node", "server.js"]
