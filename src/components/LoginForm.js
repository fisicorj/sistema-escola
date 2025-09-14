import React, { useState } from 'react';
import { useFirebaseAuth } from '../hooks/useFirebase';

export default function LoginForm() {
  const { login, register } = useFirebaseAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState('login'); // 'login' | 'register'
  const [msg, setMsg] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      if (modo === 'login') {
        const ok = await login(email, senha);
        if (!ok) setMsg('Email ou senha inválidos.');
      } else {
        await register(email, senha);
      }
    } catch (err) {
      setMsg(err.message || 'Erro.');
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '64px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0, marginBottom: 16 }}>Acessar Sistema</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={e=>setSenha(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
            required
          />
        </div>
        {msg && <div style={{ color: 'crimson', marginBottom: 12 }}>{msg}</div>}
        <button type="submit" style={{ padding: '8px 12px' }}>
          {modo === 'login' ? 'Entrar' : 'Registrar'}
        </button>
        <button
          type="button"
          onClick={()=>setModo(modo === 'login' ? 'register' : 'login')}
          style={{ padding: '8px 12px', marginLeft: 8 }}
        >
          {modo === 'login' ? 'Criar conta' : 'Ir para login'}
        </button>
      </form>
    </div>
  );
}
