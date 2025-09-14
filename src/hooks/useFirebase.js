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
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';

export const useFirebaseAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
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
  // Disciplinas
  const adicionarDisciplina = async (disciplinaData) => {
    const docRef = await addDoc(collection(db, 'disciplinas'), {
      ...disciplinaData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  };

  const listarDisciplinas = async (professorId) => {
    const q = query(
      collection(db, 'disciplinas'),
      where('professorId', '==', professorId),
      orderBy('nome')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  // Alunos
  const adicionarAluno = async (alunoData) => {
    const docRef = await addDoc(collection(db, 'alunos'), {
      ...alunoData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  const listarAlunos = async () => {
    const q = query(collection(db, 'alunos'), orderBy('nome'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  // Tipos de Avaliação
  const adicionarTipoAvaliacao = async (disciplinaId, tipoData) => {
    const docRef = await addDoc(collection(db, 'tiposAvaliacao'), {
      ...tipoData,
      disciplinaId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  const listarTiposAvaliacao = async (disciplinaId) => {
    const q = query(
      collection(db, 'tiposAvaliacao'),
      where('disciplinaId', '==', disciplinaId),
      orderBy('nome')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  // Matrículas
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
  };

  // Notas
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

  // Cloud Function callable
  const obterRelatorioNotas = async (disciplinaId) => {
    const obterRelatorio = httpsCallable(functions, 'obterRelatorioNotas');
    const result = await obterRelatorio({ disciplinaId });
    return result.data.relatorio;
  };

  return {
    adicionarDisciplina,
    listarDisciplinas,
    adicionarAluno,
    listarAlunos,
    adicionarTipoAvaliacao,
    listarTiposAvaliacao,
    matricularAluno,
    listarAlunosDisciplina,
    adicionarNota,
    atualizarNota,
    obterRelatorioNotas
  };
};
