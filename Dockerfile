FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && echo "=== DIST TREE ===" && find /app/dist -type f 2>/dev/null || echo "No dist folder"

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
