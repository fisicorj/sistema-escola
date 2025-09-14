// src/components/TurmasPage.js
import React, { useEffect, useState } from 'react';
import { useSchool } from '../hooks/useSchool';
import { useFirestore } from '../hooks/useFirebase';

export default function TurmasPage() {
  const { listarSemestres } = useSchool();
  const { listarAlunos } = useFirestore();
  const {
    adicionarTurma, listarTurmas, atualizarTurma, deletarTurma,
    matricularAlunoNaTurma, listarAlunosDaTurma, desmatricularAlunoDaTurma
  } = useSchool();

  const [semestres, setSemestres] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [alunosDaTurma, setAlunosDaTurma] = useState([]);

  const [form, setForm] = useState({ nome:'', codigo:'', turno:'Manhã', semestreId:'' });
  const [editando, setEditando] = useState(null);

  const carregarBasicos = async () => {
    const sems = await listarSemestres();
    setSemestres(sems);
    const ts = await listarTurmas();
    setTurmas(ts);
    setAlunos(await listarAlunos());
  };
  useEffect(()=>{ carregarBasicos(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.semestreId) return alert('Selecione o semestre da turma.');
    if (editando) {
      await atualizarTurma(editando.id, form);
      setEditando(null);
    } else {
      await adicionarTurma(form);
    }
    setForm({ nome:'', codigo:'', turno:'Manhã', semestreId:'' });
    setTurmas(await listarTurmas());
  };

  const iniciarEdicao = (t) => {
    setEditando(t);
    setForm({
      nome: t.nome || '',
      codigo: t.codigo || '',
      turno: t.turno || 'Manhã',
      semestreId: t.semestreId || ''
    });
  };

  const selecionarTurma = async (t) => {
    setSelecionada(t);
    setAlunosDaTurma(await listarAlunosDaTurma(t.id));
  };

  const matricular = async (alunoId) => {
    if (!selecionada) return;
    await matricularAlunoNaTurma(alunoId, selecionada.id);
    setAlunosDaTurma(await listarAlunosDaTurma(selecionada.id));
  };

  const desmatricular = async (alunoId) => {
    if (!selecionada) return;
    await desmatricularAlunoDaTurma(alunoId, selecionada.id);
    setAlunosDaTurma(await listarAlunosDaTurma(selecionada.id));
  };

  return (
    <div style={{ padding: 16, display:'grid', gridTemplateColumns:'360px 1fr', gap:16 }}>
      <aside style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
        <h3>Turmas</h3>
        <form onSubmit={salvar} style={{ display:'grid', gap:8 }}>
          <div><label>Nome</label><input value={form.nome} onChange={e=>setForm(f=>({...f, nome:e.target.value}))} required/></div>
          <div><label>Código</label><input value={form.codigo} onChange={e=>setForm(f=>({...f, codigo:e.target.value}))} required/></div>
          <div><label>Turno</label>
            <select value={form.turno} onChange={e=>setForm(f=>({...f, turno:e.target.value}))}>
              <option>Manhã</option><option>Tarde</option><option>Noite</option>
            </select>
          </div>
          <div><label>Semestre</label>
            <select value={form.semestreId} onChange={e=>setForm(f=>({...f, semestreId:e.target.value}))} required>
              <option value="">— selecione —</option>
              {semestres.map(s=><option key={s.id} value={s.id}>{s.ano}.{s.semestre}</option>)}
            </select>
          </div>
          <button type="submit">{editando ? 'Salvar alterações' : 'Criar turma'}</button>
        </form>

        <ul style={{ listStyle:'none', paddingLeft:0, marginTop:12 }}>
          {turmas.map(t=>(
            <li key={t.id}
                onClick={()=>selecionarTurma(t)}
                style={{ padding:6, borderRadius:6, cursor:'pointer', background: selecionada?.id===t.id ? '#f5f5f5':'transparent' }}>
              <strong>{t.nome}</strong> — {t.codigo} • {t.turno} • Sem {semestres.find(s=>s.id===t.semestreId)?.semestre}/{semestres.find(s=>s.id===t.semestreId)?.ano}
              <div style={{ marginTop:6 }}>
                <button onClick={(e)=>{e.stopPropagation(); iniciarEdicao(t);}}>Editar</button>
                <button onClick={(e)=>{e.stopPropagation(); if(window.confirm('Excluir turma?')) deletarTurma(t.id).then(carregarBasicos);} }
                        style={{ marginLeft:6, color:'crimson' }}>Excluir</button>
              </div>
            </li>
          ))}
          {turmas.length===0 && <li>Nenhuma turma cadastrada.</li>}
        </ul>
      </aside>

      <main style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
        {selecionada ? (
          <>
            <h3>{selecionada.nome} — {selecionada.codigo}</h3>
            <h4>Alunos da turma</h4>
            <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#f5f5f5' }}>
                <th align="left">Nome</th><th align="left">Matrícula</th><th align="left">E-mail</th><th align="left">Ações</th>
              </tr></thead>
              <tbody>
                {alunosDaTurma.map(a=>(
                  <tr key={a.id} style={{ borderTop:'1px solid #eee' }}>
                    <td>{a.nome}</td><td>{a.matricula}</td><td>{a.email || '-'}</td>
                    <td><button onClick={()=>desmatricular(a.id)} style={{ color:'crimson' }}>Desmatricular</button></td>
                  </tr>
                ))}
                {alunosDaTurma.length===0 && <tr><td colSpan="4">Sem alunos nesta turma.</td></tr>}
              </tbody>
            </table>

            <h4 style={{ marginTop:16 }}>Matricular aluno</h4>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {alunos.map(a=>(
                <button key={a.id} onClick={()=>matricular(a.id)}>{a.nome}</button>
              ))}
              {alunos.length===0 && <div>Nenhum aluno cadastrado.</div>}
            </div>
          </>
        ) : (
          <div>Selecione uma turma à esquerda.</div>
        )}
      </main>
    </div>
  );
}
