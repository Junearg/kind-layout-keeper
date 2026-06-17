FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && echo "=== DIST OUTPUT ===" && find /app/dist -type f -name "*.js" 2>/dev/null || echo "No dist folder found"

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
