FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p uploads
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
# Apply SQL migrations, then start the API.
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
