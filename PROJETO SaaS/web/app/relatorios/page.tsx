'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { reportsService, type PerformanceReport } from '@/lib/api/reports.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

function localDate(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function amount(value: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

function signedKg(value: number) {
  const formatted = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Math.abs(value));
  if (value > 0) return `+${formatted} kg`;
  if (value < 0) return `−${formatted} kg`;
  return `${formatted} kg`;
}

function percent(value: number | null) {
  return value === null
    ? '—'
    : `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)}%`;
}

export default function ReportsPage() {
  const { session, loading: authLoading } = useAuth();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return localDate(date);
  });
  const [to, setTo] = useState(() => localDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      setReport(await reportsService.summary(start, end));
    } catch (reason) {
      setReport(null);
      setError(reason instanceof ApiError
        ? reason.message
        : reason instanceof Error ? reason.message : 'Não foi possível gerar os relatórios.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (!authLoading && session) void loadReport();
  }, [authLoading, loadReport, session]);

  return (
    <WorkspaceShell title="Relatórios" eyebrow="Acompanhe a evolução dos alunos, a frequência das sessões e os resultados financeiros.">
      {error && <p className="inline-message error page-message" role="alert">{error}</p>}
      <section className="list-panel reports-filter" aria-label="Filtros do relatório">
        <div>
          <span className="panel-kicker">PERÍODO DE ANÁLISE</span>
          <p>Máximo de 366 dias. Evolução baseada nos registos de carga dos treinos.</p>
        </div>
        <form className="reports-filter-form" onSubmit={(event) => { event.preventDefault(); void loadReport(); }}>
          <label htmlFor="reports-from">De</label>
          <input id="reports-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} required />
          <label htmlFor="reports-to">Até</label>
          <input id="reports-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} required />
          <button className="button button-quiet" type="submit" disabled={loading}>{loading ? 'A atualizar…' : 'Atualizar'}</button>
        </form>
      </section>

      {loading ? (
        <div className="list-empty"><span className="spinner" />A gerar relatórios…</div>
      ) : report ? (
        <>
          <section className="reports-metrics" aria-label="Resumo da agenda e financeiro">
            <article className="metric-card"><p className="metric-label">Sessões concluídas</p><p className="metric-value">{report.attendance.completed}</p><p className="metric-detail">{report.attendance.scheduled} agendadas · {report.attendance.cancelled} canceladas</p></article>
            <article className="metric-card"><p className="metric-label">Conclusão das sessões encerradas</p><p className="metric-value">{percent(report.attendance.completionRate)}</p><p className="metric-detail">Concluídas ÷ concluídas e canceladas</p></article>
            <article className="metric-card"><p className="metric-label">Receita confirmada</p><p className="metric-value">{amount(report.finance.confirmedRevenue)}</p><p className="metric-detail">{report.finance.confirmedPayments} pagamentos no período</p></article>
            <article className="metric-card"><p className="metric-label">Pagamentos em atraso</p><p className="metric-value">{amount(report.finance.overdueAmount)}</p><p className="metric-detail">{report.finance.overduePayments} parcelas vencidas por regularizar</p></article>
          </section>

          <section className="list-panel reports-students">
            <div className="panel-heading list-heading">
              <div><span className="panel-kicker">ALUNOS ATIVOS</span><h2>Evolução e frequência</h2></div>
              <span className="count-badge">{report.students.length} alunos</span>
            </div>
            {report.students.length === 0 ? (
              <div className="list-empty compact"><strong>Sem alunos ativos no tenant</strong><p>Os relatórios individuais aparecerão quando houver alunos ativos.</p></div>
            ) : (
              <div className="reports-student-list">
                {report.students.map((student) => (
                  <article className="reports-student-card" key={student.studentId}>
                    <div className="reports-student-heading">
                      <div><span className="panel-kicker">ALUNO</span><h3>{student.studentName}</h3></div>
                      <span className="count-badge">{student.completedWorkouts} treinos concluídos</span>
                    </div>
                    <div className="reports-student-stats">
                      <span><strong>{student.appointments.completed}</strong> sessões concluídas</span>
                      <span><strong>{student.appointments.scheduled}</strong> agendadas</span>
                      <span><strong>{student.appointments.cancelled}</strong> canceladas</span>
                      <span><strong>{student.inProgressWorkouts}</strong> treinos em curso</span>
                    </div>
                    {student.evolution.length > 0 ? (
                      <div className="reports-table-scroll">
                        <table className="reports-table">
                          <thead><tr><th>Exercício</th><th>Primeiro registo</th><th>Último registo</th><th>Variação</th><th>Registos</th></tr></thead>
                          <tbody>
                            {student.evolution.map((entry) => (
                              <tr key={entry.exercise}>
                                <th scope="row">{entry.exercise}</th>
                                <td>{entry.firstLoadKg} kg</td>
                                <td>{entry.latestLoadKg} kg</td>
                                <td className={entry.changeKg > 0 ? 'report-positive' : entry.changeKg < 0 ? 'report-negative' : ''}>
                                  {signedKg(entry.changeKg)}{entry.changePercent === null ? '' : ` (${percent(entry.changePercent)})`}
                                </td>
                                <td>{entry.observations}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="reports-no-evolution">Sem registos de carga neste período. A evolução de carga só é apresentada quando os exercícios são registados com peso.</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="reports-footnote">A receita soma mensalidades e pagamentos avulsos confirmados no período. Atrasos incluem parcelas pendentes ou falhadas com vencimento anterior a hoje. Os valores da evolução comparam a carga máxima por sessão registada para cada exercício.</p>
        </>
      ) : null}
    </WorkspaceShell>
  );
}
