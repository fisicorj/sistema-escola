import React, { useState, useEffect } from 'react';

export default function NotasModal({ aberto, aluno, tipos, onClose, onSalvar }) {
  const [valores, setValores] = useState({}); // { tipoId: valor }

  useEffect(() => {
    if (aberto) setValores({});
  }, [aberto]);

  if (!aberto) return null;

  const setValor = (tipoId, v) => {
    const num = v === '' ? '' : Number(v);
    setValores(prev => ({ ...prev, [tipoId]: num }));
  };

  const salvar = () => {
    // retorna array com { tipoAvaliacaoId, valor }
    const arr = Object.entries(valores)
      .filter(([,v]) => v !== '' && !Number.isNaN(v))
      .map(([tipoAvaliacaoId, valor]) => ({ tipoAvaliacaoId, valor: Number(valor) }));
    onSalvar(arr);
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>Lançar Notas — {aluno?.nome || 'Aluno'}</h3>
        {tipos.length === 0 && <div>Não há tipos de avaliação cadastrados.</div>}
        {tipos.map(t => (
          <div key={t.id} style={row}>
            <label>{t.nome} (peso {Math.round(t.peso*100)}%)</label>
            <input
              type="number" step="0.01" min="0" max="10"
              value={valores[t.id] ?? ''}
              onChange={e=>setValor(t.id, e.target.value)}
            />
          </div>
        ))}
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
const modal = { background: '#fff', padding: 16, borderRadius: 8, minWidth: 420 };
const row = { display: 'flex', flexDirection: 'column', marginBottom: 8 };
