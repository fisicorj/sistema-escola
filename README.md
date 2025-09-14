# Sistema de Notas (Firebase + React)

App para lançamento de notas com Auth (email/senha), Firestore e Cloud Functions (média ponderada e relatório).

## Requisitos
- Node 18/20
- Firebase CLI (`npm i -g firebase-tools`)
- Projeto no Firebase (Authentication, Firestore, Hosting; Functions requer plano Blaze)

## Setup
```bash
git clone <repo>
cd sistema-notas-firebase
cp .env.example .env  # preencha com as chaves do app web do Firebase
npm install
cd functions && npm install && cd ..
