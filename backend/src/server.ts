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
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "friend_code" TEXT;`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "auto_accept_expenses" BOOLEAN NOT NULL DEFAULT false;`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_friend_code_key" ON "User"("friend_code");`
    );

    await prisma.$executeRawUnsafe(`ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "auto_accept_rule" TEXT NOT NULL DEFAULT 'DEFAULT';`
    );

    await prisma.$executeRawUnsafe(`ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "invite_code" TEXT;`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Group_invite_code_key" ON "Group"("invite_code");`
    );

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ExpenseParticipant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACCEPTED';`
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "data" JSONB,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "read_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);`
    );

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at");
    `);

    // Backfill friend_code para usuários existentes sem código
    const usersWithoutCode = await prisma.user.findMany({
      where: { friend_code: null },
      select: { id: true },
    });
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeCode = () => {
      let c = '';
      for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
      return c;
    };
    for (const u of usersWithoutCode) {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { friend_code: makeCode() },
        });
      } catch {
        // Ignora eventual colisão, será gerado sob demanda em getMe
      }
    }

    // Backfill invite_code para grupos existentes sem código
    const groupsWithoutCode = await prisma.group.findMany({
      where: { invite_code: null },
      select: { id: true },
    });
    for (const g of groupsWithoutCode) {
      try {
        await prisma.group.update({
          where: { id: g.id },
          data: { invite_code: makeCode() },
        });
      } catch {
        // Ignora eventual colisão, será gerado sob demanda em getUserGroups/getGroupById
      }
    }
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
