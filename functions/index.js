const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const region = 'southamerica-east1';

// Trigger: recalcula média ponderada ao gravar uma nota
exports.calcularMediaPonderada = functions
  .region(region)
  .firestore
  .document('notas/{notaId}')
  .onWrite(async (change) => {
    try {
      const nota = change.after.exists ? change.after.data() : null;
      if (!nota) return; // deletado

      const matriculaId = nota.matriculaId;

      // Notas da matrícula
      const notasSnapshot = await db.collection('notas')
        .where('matriculaId', '==', matriculaId)
        .get();

      // Descobrir disciplina
      const matriculaDoc = await db.collection('matriculas').doc(matriculaId).get();
      if (!matriculaDoc.exists) return;
      const disciplinaId = matriculaDoc.data().disciplinaId;

      // Tipos de avaliação da disciplina
      const tiposSnapshot = await db.collection('tiposAvaliacao')
        .where('disciplinaId', '==', disciplinaId)
        .get();

      const tipos = {};
      tiposSnapshot.forEach(doc => { tipos[doc.id] = doc.data(); });

      // Média ponderada
      let somaNotas = 0;
      let somaPesos = 0;
      notasSnapshot.forEach(doc => {
        const n = doc.data();
        const tipo = tipos[n.tipoAvaliacaoId];
        if (tipo && n.valor !== null && typeof n.valor === 'number') {
          somaNotas += n.valor * tipo.peso;
          somaPesos += tipo.peso;
        }
      });

      const mediaFinal = somaPesos > 0 ? (somaNotas / somaPesos) : null;

      // Média de aprovação
      const disciplinaDoc = await db.collection('disciplinas').doc(disciplinaId).get();
      const mediaAprovacao = (disciplinaDoc.exists && disciplinaDoc.data().mediaAprovacao) || 6.0;

      // Status
      let status = 'pendente';
      if (mediaFinal !== null) status = mediaFinal >= mediaAprovacao ? 'aprovado' : 'reprovado';

      await db.collection('matriculas').doc(matriculaId).update({
        mediaFinal,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Média calculada: ${mediaFinal}, Status: ${status}`);
    } catch (error) {
      console.error('Erro ao calcular média:', error);
    }
  });

// Trigger: loga soma de pesos por disciplina (aviso)
exports.validarPesosAvaliacao = functions
  .region(region)
  .firestore
  .document('tiposAvaliacao/{tipoId}')
  .onWrite(async (change) => {
    try {
      const tipo = change.after.exists ? change.after.data() : null;
      if (!tipo) return;

      const disciplinaId = tipo.disciplinaId;
      const tiposSnapshot = await db.collection('tiposAvaliacao')
        .where('disciplinaId', '==', disciplinaId)
        .get();

      let somaPesos = 0;
      tiposSnapshot.forEach(doc => { somaPesos += Number(doc.data().peso) || 0; });

      console.log(`Disciplina ${disciplinaId}: Soma dos pesos = ${somaPesos}`);
      // Aqui apenas avisamos. Para bloquear no ato, mova validação para regras/UX.
    } catch (error) {
      console.error('Erro ao validar pesos:', error);
    }
  });

// Callable: relatório por disciplina (apenas professor da disciplina)
exports.obterRelatorioNotas = functions
  .region(region)
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    try {
      const { disciplinaId } = data;
      const disciplinaDoc = await db.collection('disciplinas').doc(disciplinaId).get();
      if (!disciplinaDoc.exists || disciplinaDoc.data().professorId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Acesso negado');
      }

      const matriculasSnapshot = await db.collection('matriculas')
        .where('disciplinaId', '==', disciplinaId)
        .where('status', 'in', ['ativo','aprovado','reprovado']) // abrangente
        .get();

      const relatorio = [];
      for (const m of matriculasSnapshot.docs) {
        const mat = m.data();
        const alunoDoc = await db.collection('alunos').doc(mat.alunoId).get();
        const aluno = alunoDoc.exists ? alunoDoc.data() : { nome: 'N/D', matricula: 'N/D' };

        // notas por tipo
        const notasSnapshot = await db.collection('notas')
          .where('matriculaId', '==', m.id)
          .get();

        const notas = {};
        notasSnapshot.forEach(dn => {
          const n = dn.data();
          notas[n.tipoAvaliacaoId] = n.valor;
        });

        relatorio.push({
          alunoId: mat.alunoId,
          alunoNome: aluno.nome,
          matricula: aluno.matricula,
          notas,
          mediaFinal: mat.mediaFinal,
          status: mat.status
        });
      }

      return { relatorio };
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw new functions.https.HttpsError('internal', 'Erro interno do servidor');
    }
  });
