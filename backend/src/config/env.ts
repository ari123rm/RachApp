import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/rachapp';

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) 
    : ['http://localhost:5173'];

export const JWT_SECRET = process.env.JWT_SECRET || 'uma_chave_super_secreta_para_desenvolvimento';
