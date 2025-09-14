import React from 'react';
import { useFirebaseAuth } from './hooks/useFirebase';
import LoginForm from './components/LoginForm';
import SistemaNotas from './components/SistemaNotas';

export default function App() {
  const { user, loading } = useFirebaseAuth();

  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>;
  if (!user) return <LoginForm />;

  return <SistemaNotas />;
}
