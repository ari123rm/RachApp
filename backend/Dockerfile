FROM node:20-alpine

# Instala OpenSSL exigido pelo Prisma Engine no Alpine Linux
RUN apk add --no-cache openssl

WORKDIR /app

# Copia arquivos de dependências e schema do Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instala dependências e gera o Prisma Client
RUN npm install
RUN npx prisma generate

# Copia código-fonte e configuração TypeScript
COPY tsconfig.json ./
COPY src ./src/

# Compila TypeScript para JavaScript em ./dist
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Sincroniza o schema no PostgreSQL automaticamente e inicia o servidor
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
