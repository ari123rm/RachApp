// src/config/firebase.ts
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

let firebaseApp: App | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const envAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();

  // 1. Tenta carregar pela variável de ambiente FIREBASE_SERVICE_ACCOUNT
  if (envAccount) {
    // Caso A: JSON direto na variável
    if (envAccount.startsWith('{') && envAccount.endsWith('}')) {
      try {
        return JSON.parse(envAccount);
      } catch (err) {
        console.warn('Aviso: FIREBASE_SERVICE_ACCOUNT contém JSON inválido:', err);
      }
    }

    // Caso B: Caminho de arquivo indicado na variável (relativo ou absoluto)
    const possiblePath = path.isAbsolute(envAccount)
      ? envAccount
      : path.resolve(process.cwd(), envAccount);

    if (fs.existsSync(possiblePath)) {
      try {
        const fileContent = fs.readFileSync(possiblePath, 'utf8');
        return JSON.parse(fileContent);
      } catch (err) {
        console.warn('Aviso: Falha ao ler arquivo em FIREBASE_SERVICE_ACCOUNT:', err);
      }
    }

    // Caso C: Base64 do JSON
    try {
      const decoded = Buffer.from(envAccount, 'base64').toString('utf8');
      if (decoded.startsWith('{') && decoded.endsWith('}')) {
        return JSON.parse(decoded);
      }
    } catch {
      // Não era base64
    }
  }

  // 2. Tenta variáveis individuais no .env
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  // 3. Fallback: Procura arquivo *firebase-adminsdk*.json na pasta raiz do backend
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    const serviceAccountFile = rootFiles.find(
      (f) => f.includes('firebase-adminsdk') && f.endsWith('.json')
    );
    if (serviceAccountFile) {
      const filePath = path.resolve(process.cwd(), serviceAccountFile);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`🔥 [Firebase] Carregando credenciais do arquivo local: ${serviceAccountFile}`);
      return JSON.parse(content);
    }
  } catch {
    // Ignora se não for possível listar diretório
  }

  return null;
}

export function initFirebase(): App | null {
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      console.warn(
        '⚠️ [Firebase Admin] Credenciais não configuradas. Push notifications desativadas até configurar FIREBASE_SERVICE_ACCOUNT no .env.'
      );
      return null;
    }

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log('🔥 [Firebase Admin] Inicializado com sucesso!');
    return firebaseApp;
  } catch (error) {
    console.error('❌ [Firebase Admin] Erro ao inicializar:', error);
    return null;
  }
}

export function getFirebaseApp(): App | null {
  if (!firebaseApp && getApps().length > 0) {
    firebaseApp = getApps()[0];
  }
  return firebaseApp || initFirebase();
}
