# 💸 RachApp

> Um aplicativo mobile moderno para gerenciar despesas e dividir o "racha" de viagens, corridas e rolês com os amigos.

---

## 🧰 Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)

---

## ✨ Funcionalidades

- 👥 **Gestão de Amigos**  
  Adicione e gerencie as pessoas que participam das divisões.

- 🚗 **Registro de Viagens/Corridas**  
  Cadastre os custos e os participantes de cada evento.

- ⚖️ **Divisão Justa**  
  Cálculo automático do valor que cada pessoa deve pagar.

- 📱 **Interface Mobile-First**  
  Experiência otimizada para uso em dispositivos móveis.

---

## 🚀 Tecnologias

- **React** — Construção da interface
- **Vite** — Build rápido e moderno
- **TypeScript** — Tipagem estática
- **Capacitor** — App nativo (Android/iOS)

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:

- Node.js (v18+ recomendado)
- npm, yarn ou pnpm

### Mobile

- 🤖 Android: Android Studio
- 🍏 iOS: macOS + Xcode

---

## 🛠️ Como rodar o projeto

### 🌐 Ambiente Web

```bash
git clone https://github.com/seu-usuario/rachaapp.git
cd rachaapp
npm install
npm run dev
```

Acesse: http://localhost:5173

---

### 📱 Mobile (Capacitor)

#### 1. Build do projeto

```bash
npm run build
```

#### 2. Sincronizar com nativo

```bash
npx cap sync
```

#### 3. Rodar

**Android**
```bash
npx cap open android
```

**iOS**
```bash
npx cap open ios
```

---

## 🗂️ Estrutura do Projeto

```
rachaapp/
├── android/            # Projeto Android
├── ios/                # Projeto iOS
├── public/             # Arquivos públicos
├── src/
│   ├── assets/         # Imagens e SVGs
│   ├── components/     # Componentes UI
│   ├── services/       # Lógica e APIs
│   ├── types/          # Tipagens TS
│   ├── utils/          # Funções utilitárias
│   ├── App.tsx
│   └── main.tsx
├── capacitor.config.ts
└── vite.config.ts
```

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch:
   ```bash
   git checkout -b feature/minha-feature
   ```
3. Commit:
   ```bash
   git commit -m "feat: minha nova feature"
   ```
4. Push:
   ```bash
   git push origin feature/minha-feature
   ```
5. Abra um Pull Request 🚀

---

## 💙 Sobre

Feito para acabar com a confusão na hora de dividir contas entre amigos 😄

