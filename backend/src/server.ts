import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/Auth.routes';
import groupRoutes from './routes/Group.routes';
import financesRoutes from './routes/Financies.routes';
import friendRoutes from './routes/Friend.routes';

import { PORT } from './config/env';
import { prisma } from './config/db';

const app = express();

// Garante que as colunas de avatar existam mesmo antes de rodar migração manual
async function ensureAvatarColumns() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;`);
  } catch (err) {
    console.warn('Aviso ao verificar colunas de avatar:', err);
  }
}
ensureAvatarColumns();

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

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});