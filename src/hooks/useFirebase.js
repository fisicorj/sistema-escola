import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';

/** Detecta erros de índice (ainda construindo/ausente) para aplicar fallback */
const isIndexIssue = (e) =>
  e?.code === 'failed-precondition' ||
  (typeof e?.message === 'string' && e.message.toLowerCase().includes('index'));

export const useFirebaseAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const register = async (email, password) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    }
  };

  return { user, loading, login, logout, register };
};

export const useFirestore = () => {
  /* ======================
   * DISCIPLINAS
   * ====================== */
  const adicionarDisciplina = async (disciplinaData) => {
    const docRef = await addDoc(collection(db, 'disciplinas'), {
      ...disciplinaData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  };

  const listarDisciplinas = async (professorId) => {
    try {
      const q = query(
        collection(db, 'disciplinas'),
        where('professorId', '==', professorId),
        orderBy('nome')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (!isIndexIssue(e)) throw e;
      const q2 = query(
        collection(db, 'disciplinas'),
        where('professorId', '==', professorId)
      );
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
  };

  const atualizarDisciplina = async (disciplinaId, data) => {
    await updateDoc(doc(db, 'disciplinas', disciplinaId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  };

  /** Deleta disciplina e documentos relacionados (tipos, matrículas e notas) */
  const deletarDisciplinaCascade = async (disciplinaId) => {
    // 1) Tipos da disciplina
    const tiposSnap = await getDocs(
      query(collection(db, 'tiposAvaliacao'), where('disciplinaId', '==', disciplinaId))
    );
    const tipoIds = tiposSnap.docs.map(d => d.id);

    // 2) Matrículas da disciplina
    const matsSnap = await getDocs(
      query(collection(db, 'matriculas'), where('disciplinaId', '==', disciplinaId))
    );

    // 3) Notas por matrícula e por tipo (deduplicadas)
    const notaIds = new Set();

    for (const m of matsSnap.docs) {
      const notasSnap = await getDocs(
        query(collection(db, 'notas'), where('matriculaId', '==', m.id))
      );
      notasSnap.docs.forEach(n => notaIds.add(n.id));
    }

    for (const tipoId of tipoIds) {
      const notasPorTipo = await getDocs(
        query(collection(db, 'notas'), where('tipoAvaliacaoId', '==', tipoId))
      );
      notasPorTipo.docs.forEach(n => notaIds.add(n.id));
    }

    // 4) Monta refs pra deletar: notas, matrículas, tipos, depois a disciplina
    const refs = [
      ...Array.from(notaIds).map(id => doc(db, 'notas', id)),
      ...matsSnap.docs.map(m => doc(db, 'matriculas', m.id)),
      ...tiposSnap.docs.map(t => doc(db, 'tiposAvaliacao', t.id)),
      doc(db, 'disciplinas', disciplinaId)
    ];

    // 5) Deleta em lotes (máx ~500 por batch)
    while (refs.length) {
      const batch = writeBatch(db);
      const slice = refs.splice(0, 450);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  };

  /* ======================
   * ALUNOS
   * ====================== */
  /** Gera matrícula sequencial por ano (YYYY + 5 dígitos) e cria o aluno */
  const adicionarAluno = async ({ nome, email }) => {
    // 1) incrementa contador com transação (coleção counters/alunos)
    const counterRef = doc(db, 'counters', 'alunos');
    const matricula = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const year = new Date().getFullYear();
      let seq = 1;
      if (snap.exists() && snap.data()?.year === year) {
        seq = (snap.data()?.seq || 0) + 1;
      }
      tx.set(counterRef, { year, seq });
      return `${year}${String(seq).padStart(5, '0')}`; // ex.: 202500001
    });

    // 2) cria aluno com matrícula gerada
    const docRef = await addDoc(collection(db, 'alunos'), {
      nome: (nome || '').trim(),
      email: (email || '').trim() || null, // opcional
      matricula,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, matricula };
  };

  /** Edita dados do aluno (nome/email). Não altera matrícula. */
  const atualizarAluno = async (alunoId, { nome, email }) => {
    await updateDoc(doc(db, 'alunos', alunoId), {
      ...(nome != null ? { nome: String(nome).trim() } : {}),
      ...(email != null ? { email: String(email).trim() || null } : {}),
      updatedAt: serverTimestamp()
    });
  };

  const listarAlunos = async () => {
    const q = query(collection(db, 'alunos'), orderBy('nome'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  /* ======================
   * TIPOS DE AVALIAÇÃO
   * ====================== */
  const adicionarTipoAvaliacao = async (disciplinaId, tipoData) => {
    const docRef = await addDoc(collection(db, 'tiposAvaliacao'), {
      ...tipoData,
      disciplinaId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  const atualizarTipoAvaliacao = async (tipoId, data) => {
    await updateDoc(doc(db, 'tiposAvaliacao', tipoId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  };

  /** Deleta um tipo e as notas que referenciam esse tipo */
  const deletarTipoAvaliacao = async (tipoId) => {
    const notasSnap = await getDocs(
      query(collection(db, 'notas'), where('tipoAvaliacaoId', '==', tipoId))
    );
    const refs = [
      ...notasSnap.docs.map(n => doc(db, 'notas', n.id)),
      doc(db, 'tiposAvaliacao', tipoId)
    ];
    while (refs.length) {
      const batch = writeBatch(db);
      const slice = refs.splice(0, 450);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  };

  const listarTiposAvaliacao = async (disciplinaId) => {
    try {
      const q = query(
        collection(db, 'tiposAvaliacao'),
        where('disciplinaId', '==', disciplinaId),
        orderBy('nome')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (!isIndexIssue(e)) throw e;
      const q2 = query(
        collection(db, 'tiposAvaliacao'),
        where('disciplinaId', '==', disciplinaId)
      );
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
  };

  /* ======================
   * MATRÍCULAS
   * ====================== */
  /** Impede matricular o mesmo aluno duas vezes na mesma disciplina */
  const matricularAluno = async (alunoId, disciplinaId) => {
    // verifica duplicidade (preferindo consultar com 3 filtros)
    try {
      const q = query(
        collection(db, 'matriculas'),
        where('disciplinaId', '==', disciplinaId),
        where('alunoId', '==', alunoId),
        where('status', '==', 'ativo')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const err = new Error('duplicate-enrollment');
        err.code = 'duplicate-enrollment';
        throw err;
      }
    } catch (e) {
      if (e?.code === 'duplicate-enrollment') throw e;
      if (!isIndexIssue(e)) throw e;

      // fallback 1: disc+alunoId (dois filtros)
      try {
        const q2 = query(
          collection(db, 'matriculas'),
          where('disciplinaId', '==', disciplinaId),
          where('alunoId', '==', alunoId)
        );
        const snap2 = await getDocs(q2);
        if (snap2.docs.some(d => (d.data()?.status || 'ativo') === 'ativo')) {
          const err = new Error('duplicate-enrollment');
          err.code = 'duplicate-enrollment';
          throw err;
        }
      } catch (e2) {
        if (!isIndexIssue(e2)) throw e2;

        // fallback 2: só por disciplina, filtrando no cliente
        const q3 = query(collection(db, 'matriculas'), where('disciplinaId', '==', disciplinaId));
        const snap3 = await getDocs(q3);
        if (snap3.docs.some(d =>
          d.data()?.alunoId === alunoId && (d.data()?.status || 'ativo') === 'ativo'
        )) {
          const err = new Error('duplicate-enrollment');
          err.code = 'duplicate-enrollment';
          throw err;
        }
      }
    }

    // se passou, cria a matrícula
    const docRef = await addDoc(collection(db, 'matriculas'), {
      alunoId,
      disciplinaId,
      status: 'ativo',
      mediaFinal: null,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  const listarAlunosDisciplina = async (disciplinaId) => {
    try {
      const q = query(
        collection(db, 'matriculas'),
        where('disciplinaId', '==', disciplinaId),
        where('status', '==', 'ativo')
      );
      const snap = await getDocs(q);

      const alunos = [];
      for (const m of snap.docs) {
        const matricula = m.data();
        const alunoSnap = await getDoc(doc(db, 'alunos', matricula.alunoId));
        if (alunoSnap.exists()) {
          const aluno = alunoSnap.data();
          alunos.push({
            matriculaId: m.id,
            alunoId: matricula.alunoId,
            ...aluno,
            mediaFinal: matricula.mediaFinal,
            status: matricula.status
          });
        }
      }
      return alunos;
    } catch (e) {
      if (!isIndexIssue(e)) throw e;
      // fallback: filtra status no cliente
      const q2 = query(
        collection(db, 'matriculas'),
        where('disciplinaId', '==', disciplinaId)
      );
      const snap2 = await getDocs(q2);

      const alunos = [];
      for (const m of snap2.docs.filter(d => (d.data()?.status || '') === 'ativo')) {
        const matricula = m.data();
        const alunoSnap = await getDoc(doc(db, 'alunos', matricula.alunoId));
        if (alunoSnap.exists()) {
          const aluno = alunoSnap.data();
          alunos.push({
            matriculaId: m.id,
            alunoId: matricula.alunoId,
            ...aluno,
            mediaFinal: matricula.mediaFinal,
            status: matricula.status
          });
        }
      }
      return alunos;
    }
  };

  /* ======================
   * NOTAS
   * ====================== */
  const adicionarNota = async (notaData) => {
    const docRef = await addDoc(collection(db, 'notas'), {
      ...notaData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  };

  const atualizarNota = async (notaId, notaData) => {
    await updateDoc(doc(db, 'notas', notaId), {
      ...notaData,
      updatedAt: serverTimestamp()
    });
  };

  /* ======================
   * CLOUD FUNCTION CALLABLE
   * ====================== */
  const obterRelatorioNotas = async (disciplinaId) => {
    try {
      const obterRelatorio = httpsCallable(functions, 'obterRelatorioNotas');
      const result = await obterRelatorio({ disciplinaId });
      return result.data.relatorio;
    } catch (e) {
      console.warn('Callable obterRelatorioNotas indisponível, usando fallback vazio:', e?.message || e);
      return [];
    }
  };

  return {
    // Disciplinas
    adicionarDisciplina,
    listarDisciplinas,
    atualizarDisciplina,
    deletarDisciplinaCascade,
    // Alunos
    adicionarAluno,
    atualizarAluno,
    listarAlunos,
    // Tipos de avaliação
    adicionarTipoAvaliacao,
    atualizarTipoAvaliacao,
    deletarTipoAvaliacao,
    listarTiposAvaliacao,
    // Matrículas
    matricularAluno,
    listarAlunosDisciplina,
    // Notas
    adicionarNota,
    atualizarNota,
    // Relatório
    obterRelatorioNotas
  };
};
