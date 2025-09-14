// src/components/SemestresPage.js
import React, { useEffect, useState } from 'react';
import { useSchool } from '../hooks/useSchool';

export default function SemestresPage() {
  const { listarSemestres, adicionarSemestre, atualizarSemestre, deletarSemestre } = useSchool();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ ano: '', semestre: '1', dataInicio: '', dataFim: '' });
  const [editando, setEditando] = useState(null);

  const carregar = async () => setLista(await listarSemestres());
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    if (editando) {
      await atualizarSemestre(editando.id, form);
      setEditando(null);
    } else {
      await adicionarSemestre(form);
    }
    setForm({ ano: '', semestre: '1', dataInicio: '', dataFim: '' });
    carregar();
  };

  const iniciarEdicao = (s) => {
    setEditando(s);
    setForm({
      ano: s.ano || '',
      semestre: String(s.semestre || '1'),
      dataInicio: s.dataInicio ? new Date(s.dataInicio.seconds * 1000).toISOString().slice(0,10) : '',
      dataFim: s.dataFim ? new Date(s.dataFim.seconds * 1000).toISOString().slice(0,10) : ''
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <h3>Semestres Letivos</h3>
      <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 8, alignItems: 'end' }}>
        <div><label>Ano</label><input value={form.ano} onChange={e=>setForm(f=>({...f, ano:e.target.value}))} required/></div>
        <div><label>Semestre</label>
          <select value={form.semestre} onChange={e=>setForm(f=>({...f, semestre:e.target.value}))}>
            <option value="1">1</option><option value="2">2</option>
          </select>
        </div>
        <div><label>Início</label><input type="date" value={form.dataInicio} onChange={e=>setForm(f=>({...f, dataInicio:e.target.value}))}/></div>
        <div><label>Fim</label><input type="date" value={form.dataFim} onChange={e=>setForm(f=>({...f, dataFim:e.target.value}))}/></div>
        <button type="submit">{editando ? 'Salvar alterações' : 'Adicionar'}</button>
      </form>

      <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse', marginTop:12 }}>
        <thead><tr style={{ background:'#f5f5f5' }}>
          <th align="left">Ano</th><th align="left">Semestre</th><th align="left">Início</th><th align="left">Fim</th><th align="left">Ações</th>
        </tr></thead>
        <tbody>
          {lista.map(s=>(
            <tr key={s.id} style={{ borderTop:'1px solid #eee' }}>
              <td>{s.ano}</td>
              <td>{s.semestre}</td>
              <td>{s.dataInicio ? new Date(s.dataInicio.seconds*1000).toLocaleDateString() : '-'}</td>
              <td>{s.dataFim ? new Date(s.dataFim.seconds*1000).toLocaleDateString() : '-'}</td>
              <td>
                <button onClick={()=>iniciarEdicao(s)}>Editar</button>
                <button onClick={()=>{ if(window.confirm('Excluir semestre?')) deletarSemestre(s.id).then(carregar); }} style={{ marginLeft:6, color:'crimson' }}>Excluir</button>
              </td>
            </tr>
          ))}
          {lista.length===0 && <tr><td colSpan="5">Nenhum semestre.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
