import React, { useState, useEffect } from 'react';

export default function TiposAvaliacaoModal({ aberto, onClose, onSalvar }) {
  const [nome, setNome] = useState('');
  const [peso, setPeso] = useState(0.0);

  useEffect(() => {
    if (aberto) {
      setNome('');
      setPeso(0.0);
    }
  }, [aberto]);

  if (!aberto) return null;

  const salvar = () => {
    if (!nome) return;
    const p = Number(peso);
    if (Number.isNaN(p) || p <= 0 || p > 1) {
      alert('Peso deve estar entre 0 e 1 (ex.: 0.3 = 30%)');
      return;
    }
    onSalvar({ nome, peso: p });
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>Novo Tipo de Avaliação</h3>
        <div style={row}>
          <label>Nome</label>
          <input value={nome} onChange={e=>setNome(e.target.value)} />
        </div>
        <div style={row}>
          <label>Peso (0–1)</label>
          <input value={peso} onChange={e=>setPeso(e.target.value)} />
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
 