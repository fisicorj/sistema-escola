const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const region = 'southamerica-east1';

/**
 * 1) BOOTSTRAP: promove VOCÊ a admin (apenas 1ª vez).
 *    - Protegido por email autorizado (edite ADMIN_EMAIL abaixo)
 *    - Faça login no app com esse email e chame a função uma vez.
 *    - Depois, remova ou comente esta função.
 */
const ADMIN_EMAIL = 'professor@manoelmoraes.pro.br'; // <<< TROQUE AQUI

exports.bootstrapMakeMeAdmin = functions
  .region(region)
  .https.onCall(async (data, context) => {
    if (!context.auth?.token?.email) {
      throw new functions.https.HttpsError('unauthenticated', 'Faça login.');
    }
    const callerEmail = context.auth.token.email.toLowerCase();
    if (callerEmail !== ADMIN_EMAIL.toLowerCase()) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas o email autorizado pode rodar o bootstrap.');
    }

    const userRecord = await admin.auth().getUser(context.auth.uid);
    const newClaims = { ...(userRecord.customClaims || {}), admin: true };
    await admin.auth().setCustomUserClaims(context.auth.uid, newClaims);

    // opcional: marque no perfil do Firestore
    await db.collection('usuarios').doc(context.auth.uid).set({
      email: callerEmail,
      roles: { admin: true }
    }, { merge: true });

    return { ok: true, uid: context.auth.uid, claims: newClaims };
  });

/**
 * 2) Admin cria usuário Professor + define claim professor + cria doc em /usuarios.
 *    - Retorna um link de reset de senha para você enviar ao professor.
 */
exports.createProfessorUser = functions
  .region(region)
  .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas admin.');
    }
    const { email, displayName } = data;
    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Informe email.');
    }
    const emailNorm = String(email).toLowerCase();

    // cria usuário (ou retorna o existente)
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailNorm);
    } catch {
      userRecord = await admin.auth().createUser({
        email: emailNorm,
        emailVerified: false,
        password: Math.random().toString(36).slice(-12), // senha temporária aleatória
        displayName: displayName || emailNorm
      });
    }

    // set claims professor
    const newClaims = { ...(userRecord.customClaims || {}), professor: true };
    await admin.auth().setCustomUserClaims(userRecord.uid, newClaims);

    // doc em /usuarios
    await db.collection('usuarios').doc(userRecord.uid).set({
      email: emailNorm,
      nome: displayName || emailNorm,
      roles: { professor: true },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // gera link seguro para o professor definir a própria senha
    const resetLink = await admin.auth().generatePasswordResetLink(emailNorm);

    return { uid: userRecord.uid, email: emailNorm, resetLink };
  });

/**
 * 3) Admin ajusta papéis (claims) de qualquer usuário: { role, value }
 *    Exemplos: {role:'professor', value:true}, {role:'admin', value:false}
 */
exports.setUserRole = functions
  .region(region)
  .https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas admin.');
    }
    const { email, role, value } = data;
    if (!email || !role) {
      throw new functions.https.HttpsError('invalid-argument', 'Informe email e role.');
    }
    const emailNorm = String(email).toLowerCase();
    const userRecord = await admin.auth().getUserByEmail(emailNorm);
    const claims = { ...(userRecord.customClaims || {}) };
    claims[role] = !!value;
    await admin.auth().setCustomUserClaims(userRecord.uid, claims);

    // opcional: espelhar em /usuarios
    await db.collection('usuarios').doc(userRecord.uid).set({
      email: emailNorm,
      roles: { [role]: !!value }
    }, { merge: true });

    return { uid: userRecord.uid, claims };
  });

/* ---------------- suas funções existentes (ex.: médias) continuam aqui ---------------- */
// ... calcularMediaPonderada, validarPesosAvaliacao, obterRelatorioNotas (mantém como estavam)
