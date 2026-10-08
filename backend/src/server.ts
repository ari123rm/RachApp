import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/Auth.routes';
import groupRoutes from './routes/Group.routes';
import financesRoutes from './routes/Financies.routes';
import friendRoutes from './routes/Friend.routes';

import { PORT, ALLOWED_ORIGINS } from './config/env';

const app = express();

// Middlewares de segurança e parse de JSON
app.use(helmet());
app.use(cors({
  origin: ALLOWED_ORIGINS
}));
app.use(express.json());

// Rota de teste
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'RachApp API rodando!' });
});
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/friends', friendRoutes);
// Importação das rotas (Você criará estas rotas em seguida)


app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});