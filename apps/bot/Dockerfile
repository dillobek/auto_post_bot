FROM node:20-alpine
WORKDIR /app/apps/bot
ENV NODE_ENV=production
COPY apps/bot/package.json apps/bot/package-lock.json ./
RUN npm ci
COPY apps/bot/ ./
CMD ["npm", "run", "start"]
