import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/Auth.routes';
import groupRoutes from './routes/Group.routes';
import financesRoutes from './routes/Financies.routes';
import friendRoutes from './routes/Friend.routes';

import { PORT } from './config/env';

const app = express();

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