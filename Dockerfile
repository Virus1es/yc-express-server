FROM mcr.microsoft.com/playwright:v1.64.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY app.js index.js ./

CMD ["node", "index.js"]