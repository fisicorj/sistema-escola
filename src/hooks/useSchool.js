// src/hooks/useSchool.js
import { useMemo } from 'react';
import {
  collection, addDoc, setDoc, doc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

/** Util: lê um documento por ID, retornando {id,...data} ou null */
const readById = async (col, id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export function useSchool() {
  // =========================
  // SEMESTRES
  // =========================
  const adicionarSemestre = async ({ ano, semestre, dataInicio, dataFim }) => {
    const payload = {
      ano: Number(ano),
      semestre: Number(semestre), // 1 ou 2
      dataInicio: dataInicio ? new Date(dataInicio) : null,
      dataFim: dataFim ? new Date(dataFim) : null,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'semestres'), payload);
    return ref.id;
  };

  const listarSemestres = async () => {
    const q = query(
      collection(db, 'semestres'),
      orderBy('ano', 'desc'),
      orderBy('semestre', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const atualizarSemestre = async (id, data) => {
    await updateDoc(doc(db, 'semestres', id), {
      ...(data.ano != null ? { ano: Number(data.ano) } : {}),
      ...(data.semestre != null ? { semestre: Number(data.semestre) } : {}),
      ...(data.dataInicio != null ? { dataInicio: data.dataInicio ? new Date(data.dataInicio) : null } : {}),
      ...(data.dataFim != null ? { dataFim: data.dataFim ? new Date(data.dataFim) : null } : {}),
      updatedAt: serverTimestamp()
    });
  };

  const deletarSemestre = async (id) => {
    await deleteDoc(doc(db, 'semestres', id));
  };

  // =========================
  // TURMAS
  // =========================
  const adicionarTurma = async ({ nome, codigo, turno, cursoId = null, instituicaoId = null, semestreId }) => {
    const payload = {
      nome: (nome || '').trim(),
      codigo: (codigo || '').trim(), // mantenha único pelo seu uso
      turno: (turno || 'Manhã'),
      cursoId: cursoId || null,
      instituicaoId: instituicaoId || null,
      semestreId,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'turmas'), payload);
    return ref.id;
  };

  const listarTurmas = async ({ semestreId = null } = {}) => {
    let qy = query(collection(db, 'turmas'), orderBy('nome'));
    if (semestreId) {
      qy = query(collection(db, 'turmas'), where('semestreId', '==', semestreId), orderBy('nome'));
    }
    const snap = await getDocs(qy);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const atualizarTurma = async (id, data) => {
    await updateDoc(doc(db, 'turmas', id), {
      ...(data.nome != null ? { nome: String(data.nome).trim() } : {}),
      ...(data.codigo != null ? { codigo: String(data.codigo).trim() } : {}),
      ...(data.turno != null ? { turno: String(data.turno) } : {}),
      ...(data.cursoId !== undefined ? { cursoId: data.cursoId || null } : {}),
      ...(data.instituicaoId !== undefined ? { instituicaoId: data.instituicaoId || null } : {}),
      ...(data.semestreId !== undefined ? { semestreId: data.semestreId } : {}),
      updatedAt: serverTimestamp()
    });
  };

  const deletarTurma = async (id) => {
    // por ora só remove a turma (depois podemos mover o cascade para Function)
    await deleteDoc(doc(db, 'turmas', id));
  };

  // =========================
  // MATRÍCULA EM TURMA (única por ID composto)
  // =========================
  /** Cria/garante matrícula única por turma+aluno usando ID `${turmaId}_${alunoId}` */
  const matricularAlunoNaTurma = async (alunoId, turmaId, status = 'ativo') => {
    const id = `${turmaId}_${alunoId}`;
    await setDoc(doc(db, 'matriculasTurma', id), {
      alunoId, turmaId, status,
      createdAt: serverTimestamp()
    }, { merge: true });
    return id;
  };

  const listarAlunosDaTurma = async (turmaId) => {
    const qy = query(collection(db, 'matriculasTurma'), where('turmaId', '==', turmaId), where('status', '==', 'ativo'));
    const snap = await getDocs(qy);

    const out = [];
    for (const d of snap.docs) {
      const { alunoId } = d.data();
      const aluno = await readById('alunos', alunoId);
      if (aluno) out.push({ ...aluno, matriculaTurmaId: d.id });
    }
    return out;
  };

  const desmatricularAlunoDaTurma = async (alunoId, turmaId) => {
    const id = `${turmaId}_${alunoId}`;
    await updateDoc(doc(db, 'matriculasTurma', id), { status: 'cancelado', updatedAt: serverTimestamp() });
  };

  return useMemo(() => ({
    // Semestres
    adicionarSemestre, listarSemestres, atualizarSemestre, deletarSemestre,
    // Turmas
    adicionarTurma, listarTurmas, atualizarTurma, deletarTurma,
    // Matrículas de Turma
    matricularAlunoNaTurma, listarAlunosDaTurma, desmatricularAlunoDaTurma
  }), []);
}
