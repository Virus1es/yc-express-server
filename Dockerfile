FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY app.js index.js ./

CMD ["node", "index.js"]