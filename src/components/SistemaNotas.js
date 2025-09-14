import React, { useEffect, useState } from 'react';
import { useFirebaseAuth, useFirestore } from '../hooks/useFirebase';
import TiposAvaliacaoModal from './TiposAvaliacaoModal';
import NotasModal from './NotasModal';
import DisciplinaModal from './DisciplinaModal';
import AlunoModal from './AlunoModal';

export default function SistemaNotas() {
  const { user, logout } = useFirebaseAuth();
  const {
    listarDisciplinas, adicionarDisciplina, atualizarDisciplina, deletarDisciplinaCascade,
    listarAlunos, adicionarAluno, atualizarAluno,
    adicionarTipoAvaliacao, atualizarTipoAvaliacao, deletarTipoAvaliacao, listarTiposAvaliacao,
    matricularAluno, listarAlunosDisciplina,
    adicionarNota, obterRelatorioNotas
  } = useFirestore();

  const [disciplinas, setDisciplinas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [alunosDisc, setAlunosDisc] = useState([]);
  const [abrirTipos, setAbrirTipos] = useState(false);
  const [abrirNotas, setAbrirNotas] = useState(false);
  const [abrirEditarDisc, setAbrirEditarDisc] = useState(false);
  const [abrirAluno, setAbrirAluno] = useState(false);
  const [alunoEditando, setAlunoEditando] = useState(null);
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [relatorio, setRelatorio] = useState([]);
  const [tipoEditando, setTipoEditando] = useState(null);

  // Carrega disciplinas e alunos do professor logado
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ds = await listarDisciplinas(user.uid);
      setDisciplinas(ds);
      const as = await listarAlunos();
      setAlunos(as);
    })();
  }, [user]); // eslint-disable-line

  // Quando seleciona uma disciplina, carrega tipos e alunos matriculados
  useEffect(() => {
    if (!selecionada) { setTipos([]); setAlunosDisc([]); return; }
    (async () => {
      const ts = await listarTiposAvaliacao(selecionada.id);
      setTipos(ts);
      const ads = await listarAlunosDisciplina(selecionada.id);
      setAlunosDisc(ads);
    })();
  }, [selecionada]); // eslint-disable-line

  const criarDisciplina = async () => {
    const nome = prompt('Nome da disciplina:');
    if (!nome) return;
    const mediaAprovacao = Number(prompt('Média de aprovação (ex.: 6):', '6'));
    const codigo = prompt('Código (ex.: BCC001):') || '';
    const id = await adicionarDisciplina({
      nome, codigo,
      professorId: user.uid,
      mediaAprovacao: Number.isNaN(mediaAprovacao) ? 6 : mediaAprovacao
    });
    const ds = await listarDisciplinas(user.uid);
    setDisciplinas(ds);
    const nova = ds.find(d => d.id === id);
    setSelecionada(nova || null);
  };

  const abrirEdicaoDisciplina = () => setAbrirEditarDisc(true);

  const salvarEdicaoDisciplina = async (dados) => {
    if (!selecionada) return;
    await atualizarDisciplina(selecionada.id, dados);
    const ds = await listarDisciplinas(user.uid);
    setDisciplinas(ds);
    const atual = ds.find(d => d.id === selecionada.id) || null;
    setSelecionada(atual);
  };

  const excluirDisciplina = async () => {
    if (!selecionada) return;
    const ok = window.confirm(
      `Tem certeza que deseja excluir a disciplina "${selecionada.nome}" e TODOS os dados relacionados (tipos, matrículas e notas)?`
    );
    if (!ok) return;
    await deletarDisciplinaCascade(selecionada.id);
    setSelecionada(null);
    const ds = await listarDisciplinas(user.uid);
    setDisciplinas(ds);
    setTipos([]);
    setAlunosDisc([]);
    setRelatorio([]);
  };

  const abrirCriarAluno = () => { setAlunoEditando(null); setAbrirAluno(true); };
  const abrirEditarAluno = (a) => { setAlunoEditando(a); setAbrirAluno(true); };

  const salvarAluno = async ({ nome, email }) => {
    if (alunoEditando) {
      await atualizarAluno(alunoEditando.id, { nome, email });
      setAlunoEditando(null);
      const as = await listarAlunos();
      setAlunos(as);
      alert('Aluno atualizado!');
    } else {
      const res = await adicionarAluno({ nome, email });
      const as = await listarAlunos();
      setAlunos(as);
      alert(`Aluno cadastrado!\nMatrícula gerada: ${res.matricula}`);
    }
  };

  const matricular = async (alunoId) => {
    if (!selecionada) return;
    try {
      await matricularAluno(alunoId, selecionada.id);
      const ads = await listarAlunosDisciplina(selecionada.id);
      setAlunosDisc(ads);
    } catch (e) {
      if (e?.code === 'duplicate-enrollment') {
        alert('Este aluno já está matriculado nesta disciplina.');
      } else {
        console.error(e);
        alert('Não foi possível matricular. Tente novamente.');
      }
    }
  };

  const abrirCriarTipo = () => { setTipoEditando(null); setAbrirTipos(true); };
  const abrirEditarTipo = (tipo) => { setTipoEditando(tipo); setAbrirTipos(true); };

  const salvarTipo = async (dados) => {
    if (!selecionada) return;
    if (tipoEditando) {
      await atualizarTipoAvaliacao(tipoEditando.id, dados);
      setTipoEditando(null);
    } else {
      await adicionarTipoAvaliacao(selecionada.id, dados);
    }
    const ts = await listarTiposAvaliacao(selecionada.id);
    setTipos(ts);
  };

  const excluirTipo = async (tipo) => {
    const ok = window.confirm(`Excluir o tipo "${tipo.nome}"? Notas desse tipo também serão apagadas.`);
    if (!ok) return;
    await deletarTipoAvaliacao(tipo.id);
    const ts = await listarTiposAvaliacao(selecionada.id);
    setTipos(ts);
  };

  const lancarNotas = async (itens) => {
    if (!selecionada || !alunoSelecionado) return;
    for (const it of itens) {
      await adicionarNota({
        matriculaId: alunoSelecionado.matriculaId,
        tipoAvaliacaoId: it.tipoAvaliacaoId,
        valor: it.valor
      });
    }
    alert('Notas lançadas. A média será recalculada pela Cloud Function.');
  };

  const gerarRelatorio = async () => {
    if (!selecionada) return;
    const r = await obterRelatorioNotas(selecionada.id);
    setRelatorio(r);
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Sistema de Notas</h2>
        <div>
          <span style={{ marginRight: 12 }}>{user?.email}</span>
          <button onClick={logout}>Sair</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 16 }}>
        {/* Lateral esquerda */}
        <aside style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3>Disciplinas</h3>
          <button onClick={criarDisciplina} style={{ marginBottom: 8 }}>+ Nova disciplina</button>
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {disciplinas.map(d => (
              <li
                key={d.id}
                style={{
                  padding: 6,
                  cursor: 'pointer',
                  background: selecionada?.id === d.id ? '#f5f5f5' : 'transparent',
                  borderRadius: 6
                }}
                onClick={() => setSelecionada(d)}
              >
                <strong>{d.nome}</strong> {d.codigo ? `— ${d.codigo}` : ''}
                <div style={{ fontSize: 12, color: '#666' }}>Média: {d.mediaAprovacao ?? 6}</div>
              </li>
            ))}
          </ul>

          <hr />

          <h3>Alunos</h3>
          <button onClick={abrirCriarAluno} style={{ marginBottom: 8 }}>+ Novo aluno</button>
          <ul style={{ listStyle: 'none', paddingLeft: 0, maxHeight: 240, overflow: 'auto' }}>
            {alunos.map(a => (
              <li key={a.id} style={{ padding: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div>{a.nome}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Matrícula: {a.matricula} {a.email ? `• ${a.email}` : ''}
                    </div>
                  </div>
                  <div>
                    <button onClick={() => matricular(a.id)} disabled={!selecionada}>Matricular</button>
                    <button onClick={() => abrirEditarAluno(a)} style={{ marginLeft: 8 }}>Editar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conteúdo principal */}
        <main style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          {selecionada ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{selecionada.nome}</h3>
                <button onClick={abrirEdicaoDisciplina}>Editar disciplina</button>
                <button onClick={async () => { const r = await obterRelatorioNotas(selecionada.id); setRelatorio(r); }}>
                  Gerar relatório
                </button>
                <button onClick={() => { setTipoEditando(null); setAbrirTipos(true); }}>+ Tipo de avaliação</button>
                <button onClick={excluirDisciplina} style={{ marginLeft: 'auto', color: 'crimson' }}>
                  Excluir disciplina
                </button>
              </div>

              <h4>Tipos de avaliação</h4>
              <ul style={{ paddingLeft: 16 }}>
                {tipos.map(t => (
                  <li key={t.id} style={{ marginBottom: 6 }}>
                    {t.nome} — peso {Math.round(t.peso * 100)}%
                    <button onClick={() => { setTipoEditando(t); setAbrirTipos(true); }} style={{ marginLeft: 8 }}>Editar</button>
                    <button onClick={() => excluirTipo(t)} style={{ marginLeft: 4, color: 'crimson' }}>Excluir</button>
                  </li>
                ))}
                {tipos.length === 0 && <li>Nenhum tipo cadastrado.</li>}
              </ul>

              <h4>Alunos matriculados</h4>
              <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th align="left">Aluno</th>
                    <th align="left">Matrícula</th>
                    <th align="left">E-mail</th>
                    <th align="left">Média</th>
                    <th align="left">Status</th>
                    <th align="left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {alunosDisc.map(a => (
                    <tr key={a.matriculaId} style={{ borderTop: '1px solid #eee' }}>
                      <td>{a.nome}</td>
                      <td>{a.matricula || '-'}</td>
                      <td>{a.email || '-'}</td>
                      <td>{a.mediaFinal != null ? a.mediaFinal.toFixed(2) : '-'}</td>
                      <td>{a.status || '-'}</td>
                      <td>
                        <button onClick={() => { setAlunoSelecionado(a); setAbrirNotas(true); }}>
                          Lançar notas
                        </button>
                      </td>
                    </tr>
                  ))}
                  {alunosDisc.length === 0 && (
                    <tr><td colSpan="6">Ninguém matriculado.</td></tr>
                  )}
                </tbody>
              </table>

              <h4 style={{ marginTop: 16 }}>Relatório</h4>
              {relatorio.length === 0 ? (
                <div>Nenhum relatório carregado.</div>
              ) : (
                <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th align="left">Aluno</th>
                      <th align="left">Matrícula</th>
                      <th align="left">Média</th>
                      <th align="left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.map((r, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                        <td>{r.alunoNome}</td>
                        <td>{r.matricula}</td>
                        <td>{r.mediaFinal != null ? r.mediaFinal.toFixed(2) : '-'}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Modais */}
              <TiposAvaliacaoModal
                aberto={abrirTipos}
                onClose={() => { setAbrirTipos(false); setTipoEditando(null); }}
                onSalvar={(dados) => {
                  if (!selecionada) return;
                  if (tipoEditando) {
                    atualizarTipoAvaliacao(tipoEditando.id, dados).then(async () => {
                      setTipoEditando(null);
                      const ts = await listarTiposAvaliacao(selecionada.id);
                      setTipos(ts);
                    });
                  } else {
                    adicionarTipoAvaliacao(selecionada.id, dados).then(async () => {
                      const ts = await listarTiposAvaliacao(selecionada.id);
                      setTipos(ts);
                    });
                  }
                }}
                inicial={tipoEditando}
              />

              <NotasModal
                aberto={abrirNotas}
                onClose={() => setAbrirNotas(false)}
                aluno={alunoSelecionado}
                tipos={tipos}
                onSalvar={lancarNotas}
              />

              <DisciplinaModal
                aberto={abrirEditarDisc}
                onClose={() => setAbrirEditarDisc(false)}
                inicial={selecionada}
                onSalvar={salvarEdicaoDisciplina}
              />
            </>
          ) : (
            <div>Selecione uma disciplina à esquerda.</div>
          )}
        </main>
      </section>

      {/* Modal de aluno (criar/editar) */}
      <AlunoModal
        aberto={abrirAluno}
        onClose={() => { setAbrirAluno(false); setAlunoEditando(null); }}
        inicial={alunoEditando}
        onSalvar={salvarAluno}
      />
    </div>
  );
}
