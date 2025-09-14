import React, { useEffect, useState } from 'react';

export default function AlunoModal({ aberto, onClose, inicial, onSalvar }) {
  const editMode = Boolean(inicial);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome(inicial?.nome ?? '');
      setEmail(inicial?.email ?? '');
    }
  }, [aberto, inicial]);

  if (!aberto) return null;

  const salvar = () => {
    if (!nome.trim()) return alert('Informe o nome do aluno.');
    onSalvar({ nome: nome.trim(), email: email.trim() || null });
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>{editMode ? 'Editar aluno' : 'Novo aluno'}</h3>
        <div style={row}>
          <label>Nome</label>
          <input value={nome} onChange={e=>setNome(e.target.value)} />
        </div>
        <div style={row}>
          <label>E-mail (opcional)</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={salvar}>{editMode ? 'Salvar alterações' : 'Salvar'}</button>
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
