// src/middlewares/AuthMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

// Expandir a tipagem do Express para reconhecer o "req.user"
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        name: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  // O cabeçalho vem no formato: "Bearer <token>"
  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as {
      userId: string;
      name: string;
    };
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    // Injetamos os dados descodificados no request
    req.user = decoded;

    return next(); // Tudo certo, passa para o Controller
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}
