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
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';

/** Detecta erros de índice (ainda construindo ou ausente) para aplicar fallback */
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

  /** Deleta disciplina e documentos relacionados (tipos, matrículas, notas) em lotes */
  const deletarDisciplinaCascade = async (disciplinaId) => {
    // 1) Buscar tipos da disciplina
    const tiposSnap = await getDocs(
      query(collection(db, 'tiposAvaliacao'), where('disciplinaId', '==', disciplinaId))
    );
    const tipoIds = tiposSnap.docs.map(d => d.id);

    // 2) Buscar matrículas da disciplina
    const matsSnap = await getDocs(
      query(collection(db, 'matriculas'), where('disciplinaId', '==', disciplinaId))
    );

    // 3) Apagar notas das matrículas
    const notaDocRefs = [];
    for (const m of matsSnap.docs) {
      const notasSnap = await getDocs(
        query(collection(db, 'notas'), where('matriculaId', '==', m.id))
      );
      notasSnap.docs.forEach(n => notaDocRefs.push(doc(db, 'notas', n.id)));
    }

    // 4) Também apagar notas por tipo (por segurança)
    for (const tipoId of tipoIds) {
      const notasPorTipo = await getDocs(
        query(collection(db, 'notas'), where('tipoAvaliacaoId', '==', tipoId))
      );
      notasPorTipo.docs.forEach(n => notaDocRefs.push(doc(db, 'notas', n.id)));
    }

    // 5) Montar refs pra deletar: notas, matrículas, tipos, depois a disciplina
    const refsParaDeletar = [
      ...notaDocRefs,
      ...matsSnap.docs.map(m => doc(db, 'matriculas', m.id)),
      ...tiposSnap.docs.map(t => doc(db, 'tiposAvaliacao', t.id)),
      doc(db, 'disciplinas', disciplinaId)
    ];

    // 6) Deletar em lotes (máx 450 por batch)
    while (refsParaDeletar.length) {
      const batch = writeBatch(db);
      const slice = refsParaDeletar.splice(0, 450);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  };

  /* ======================
   * ALUNOS
   * ====================== */
  const adicionarAluno = async (alunoData) => {
    const docRef = await addDoc(collection(db, 'alunos'), {
      ...alunoData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
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

  /** Deleta um tipo e apaga notas que referenciam esse tipo */
  const deletarTipoAvaliacao = async (tipoId) => {
    // apagar notas que usam esse tipo
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
  const matricularAluno = async (alunoId, disciplinaId) => {
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
      const matriculasSnapshot = await getDocs(q);

      const alunos = [];
      for (const m of matriculasSnapshot.docs) {
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
