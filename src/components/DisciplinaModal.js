import React, { useEffect, useState } from 'react';

export default function DisciplinaModal({ aberto, onClose, inicial, onSalvar }) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mediaAprovacao, setMediaAprovacao] = useState(6);

  useEffect(() => {
    if (aberto && inicial) {
      setNome(inicial.nome || '');
      setCodigo(inicial.codigo || '');
      setMediaAprovacao(inicial.mediaAprovacao ?? 6);
    }
  }, [aberto, inicial]);

  if (!aberto) return null;

  const salvar = () => {
    if (!nome.trim()) return alert('Informe o nome da disciplina.');
    const m = Number(mediaAprovacao);
    if (Number.isNaN(m) || m <= 0) return alert('Média de aprovação inválida.');
    onSalvar({ nome: nome.trim(), codigo: codigo.trim(), mediaAprovacao: m });
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>Editar disciplina</h3>
        <div style={row}>
          <label>Nome</label>
          <input value={nome} onChange={e=>setNome(e.target.value)} />
        </div>
        <div style={row}>
          <label>Código</label>
          <input value={codigo} onChange={e=>setCodigo(e.target.value)} />
        </div>
        <div style={row}>
          <label>Média de aprovação</label>
          <input value={mediaAprovacao} onChange={e=>setMediaAprovacao(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={salvar}>Salvar</button>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 50
};
const modal = { background: '#fff', padding: 16, borderRadius: 8, minWidth: 360 };
const row = { display: 'flex', flexDirection: 'column', marginBottom: 8 };
