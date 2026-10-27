import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/Auth.routes';
import groupRoutes from './routes/Group.routes';
import financesRoutes from './routes/Financies.routes';
import friendRoutes from './routes/Friend.routes';
import notificationRoutes from './routes/Notification.routes';
import { initSocketServer } from './services/socket.service';
import { initFirebase } from './config/firebase';

import { PORT } from './config/env';
import { prisma } from './config/db';

const app = express();
const httpServer = http.createServer(app);

// Inicializa WebSocket (Socket.io) e Firebase Admin
initSocketServer(httpServer);
initFirebase();

// Garante que tabelas e colunas complementares existam mesmo antes de rodar migração manual
async function ensureDatabaseSchema() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fcm_token" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "data" JSONB,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at");
    `);
  } catch (err) {
    console.warn('Aviso ao verificar schema complementar:', err);
  }
}
ensureDatabaseSchema();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'RachApp API rodando!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} (HTTP + WebSocket)`);
});
