import './style.css';
import { createClient } from '@supabase/supabase-js';

const icons = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  arrowDown: '<path d="m7 10 5 5 5-5"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  dumbbell: '<path d="m6.5 6.5 11 11M21 21l-1-1m-4-4 3-3m-9-9 3-3m-8 8 3-3m-5 5 3-3m11 11 3-3M3 3l1 1"/>',
  ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  students: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  wallet: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20M16 15h.01"/>',
};

const icon = (name, size = 20) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? ''}</svg>`;

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

let activePage = 'overview';
let studentFilter = 'Todos';
let studentPageNumber = 1;
let searchValue = '';
let supabase;
let session;
let currentUser;
let pageData;
let pageError;
let loading = false;
let loginMessage = '';
let pageLoadId = 0;

const app = document.querySelector('#app');

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase('pt-BR') || '?';
}

function colorFor(value = '') {
  const colors = ['lilac', 'mint', 'peach', 'blue', 'rose', 'sand'];
  return colors[[...value].reduce((total, char) => total + char.charCodeAt(0), 0) % colors.length];
}

function studentAvatar(student) {
  const name = student.name ?? '';
  return avatar(initials(name), colorFor(student.id ?? name));
}

function cycleLabel(cycle) {
  return ({ MONTHS_3: '3 meses', MONTHS_6: '6 meses', MONTHS_12: '12 meses' })[cycle] ?? 'Sem contrato';
}

function dateLabel(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value)).replace('.', '');
}

function relativeDate(value) {
  if (!value) return 'Sem atualização';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Atualizado hoje';
  if (days === 1) return 'Atualizado ontem';
  return `Atualizado há ${days} dias`;
}

function sidebar() {
  const nav = [
    { id: 'overview', label: 'Visão geral', icon: 'grid', group: 'MENU PRINCIPAL' },
    { id: 'students', label: 'Alunos', icon: 'students' },
    { id: 'workouts', label: 'Treinos', icon: 'dumbbell' },
    { id: 'finance', label: 'Financeiro', icon: 'wallet', group: 'GESTÃO' },
  ];

  let lastGroup = '';
  const links = nav.map((item) => {
    const heading = item.group && item.group !== lastGroup ? `<p class="nav-group">${item.group}</p>` : '';
    if (item.group) lastGroup = item.group;
    return `${heading}<button class="nav-link ${activePage === item.id ? 'active' : ''}" data-page="${item.id}">
      ${icon(item.icon, 19)}<span>${item.label}</span>${item.count ? `<span class="nav-count">${item.count}</span>` : ''}
    </button>`;
  }).join('');

  return `<aside class="sidebar" id="sidebar">
    <a class="brand" href="#" data-page="overview"><span class="brand-mark">${icon('activity', 20)}</span><span>forma<span class="brand-dot">.</span></span></a>
    <div class="workspace"><span class="workspace-avatar">${escapeHTML(initials(currentUser?.name))}</span><span class="workspace-copy"><strong>${escapeHTML(currentUser?.name ?? '')}</strong><small>Personal trainer</small></span>${icon('arrowDown', 15)}</div>
    <nav class="navigation" aria-label="Navegação principal">${links}</nav>
    <div class="sidebar-bottom">
      <div class="help-card"><span class="help-icon">${icon('help', 18)}</span><strong>Precisa de ajuda?</strong><p>Estamos aqui para você.</p><button class="help-link" data-toast="O suporte estará disponível em breve.">Acessar suporte ${icon('arrowRight', 15)}</button></div>
      <div class="profile"><span class="profile-avatar">${escapeHTML(initials(currentUser?.name))}</span><span class="profile-copy"><strong>${escapeHTML(currentUser?.name ?? '')}</strong><small>${escapeHTML(currentUser?.email ?? '')}</small></span><button class="icon-button profile-menu" aria-label="Sair da conta" data-action="sign-out">${icon('ellipsis')}</button></div>
    </div>
  </aside>`;
}

function pageHeading(title, subtitle, action = '') {
  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  return `<div class="page-heading"><div><p class="eyebrow">${escapeHTML(today.toLocaleUpperCase('pt-BR'))}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action}</div>`;
}

function connectionNote() {
  return `<div class="connection-note"><span class="connection-dot"></span><span>Dados conectados ao Supabase</span></div>`;
}

function metricCard({ label, value, note, change, iconName, color, arrow = true }) {
  return `<article class="metric-card"><div class="metric-top"><span class="metric-icon ${color}">${icon(iconName, 19)}</span><span class="metric-change">${arrow ? icon('arrowUpRight', 14) : ''}${change}</span></div><p class="metric-label">${label}</p><strong class="metric-value">${value}</strong><p class="metric-note">${note}</p></article>`;
}

function avatar(initials, color, size = '') {
  return `<span class="avatar ${color} ${size}">${initials}</span>`;
}

function dashboard(data) {
  const chart = data.finance.chart;
  const maxValue = Math.max(...chart.map((month) => month.received), 1);
  const bars = chart.map((month, index) => {
    const height = month.received === 0 ? 0 : Math.max(4, Math.round((month.received / maxValue) * 86));
    const current = index === chart.length - 1;
    return `<div class="chart-column"><span class="chart-tooltip">${money(month.received)}</span><div class="bar-track"><span class="bar ${current ? 'current' : ''}" style="height:${height}%"></span></div><span class="chart-label ${current ? 'current-label' : ''}">${escapeHTML(month.label)}</span></div>`;
  }).join('');
  const ticks = [maxValue, maxValue * 2 / 3, maxValue / 3, 0].map((value) =>
    `<span>${value === 0 ? '0' : `${new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`}</span>`,
  ).join('');
  const upcoming = data.contracts.upcoming.map((contract) => `
    <div class="schedule-row">${avatar(initials(contract.student), colorFor(contract.id))}<div class="schedule-person"><strong>${escapeHTML(contract.student)}</strong><span>Contrato · ${escapeHTML(cycleLabel(contract.cycle))}</span></div><span class="schedule-time">${dateLabel(contract.endDate, { day: '2-digit', month: 'short' })}</span></div>`).join('');
  const attention = [
    ...data.workouts.reviewItems.map((workout) => ({
      iconName: 'dumbbell',
      color: 'warning',
      title: 'Treino sem atualização',
      detail: `${workout.student} · ${relativeDate(workout.updatedAt).replace('Atualizado ', '')}`,
      page: 'workouts',
    })),
    ...data.contracts.upcoming.slice(0, 2).map((contract) => ({
      iconName: 'calendar',
      color: 'info',
      title: 'Contrato próximo do vencimento',
      detail: `${contract.student} · ${dateLabel(contract.endDate)}`,
      page: 'students',
    })),
  ].slice(0, 3);
  if (data.finance.overdueCount > 0) {
    attention.push({
      iconName: 'wallet',
      color: 'danger',
      title: 'Pagamento em atraso',
      detail: `${data.finance.overdueCount} pagamento(s)`,
      page: 'finance',
    });
  }
  const attentionRows = attention.length
    ? attention.map((item) => `<div class="attention-item"><span class="attention-symbol ${item.color}">${icon(item.iconName, 18)}</span><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.detail)}</span></div><button aria-label="Ver detalhes" class="icon-button" data-page="${item.page}">${icon('arrowRight', 18)}</button></div>`).join('')
    : '<p class="empty-inline">Nenhuma pendência encontrada nos seus dados.</p>';
  const totalReceived = chart.reduce((total, month) => total + month.received, 0);

  return `${pageHeading(`Olá, ${escapeHTML(currentUser.name.split(' ')[0])}! <span class="heading-wave">✦</span>`, 'Aqui está o resumo atualizado do seu negócio.')}
    ${connectionNote()}
    <section class="metrics-grid" aria-label="Resumo do negócio">
      ${metricCard({ label: 'Alunos ativos', value: data.students.active, note: `${data.students.total} cadastrados`, change: `+${data.students.newThisMonth} este mês`, iconName: 'students', color: 'icon-blue', arrow: false })}
      ${metricCard({ label: 'Receita recorrente', value: money(data.finance.recurringRevenue), note: 'dos contratos ativos', change: 'Mensal', iconName: 'wallet', color: 'icon-green', arrow: false })}
      ${metricCard({ label: 'Treinos ativos', value: data.workouts.active, note: 'cadastrados no sistema', change: `${data.workouts.needsReview} para revisar`, iconName: 'dumbbell', color: 'icon-violet', arrow: false })}
      ${metricCard({ label: 'Pendências financeiras', value: data.finance.overdueCount, note: `${money(data.finance.receivable)} a receber`, change: `${data.pendingExams} exame(s) pendente(s)`, iconName: 'activity', color: 'icon-amber', arrow: false })}
    </section>
    <section class="dashboard-grid">
      <article class="card revenue-card">
        <div class="card-heading"><div><h2>Receita recebida</h2><p>Pagamentos confirmados nos últimos 6 meses</p></div><button class="select-button" data-page="finance">Ver financeiro ${icon('arrowRight', 15)}</button></div>
        <div class="chart-wrap"><div class="chart-y-labels">${ticks}</div><div class="chart-plot"><div class="chart-grid-lines"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${bars || '<p class="empty-inline">Sem movimentações neste período.</p>'}</div></div></div>
        <div class="chart-footer"><span class="chart-legend"><i></i> Receita recebida</span><span class="chart-total">Total no período <strong>${money(totalReceived)}</strong></span></div>
      </article>
      <article class="card schedule-card">
        <div class="card-heading"><div><h2>Contratos a vencer</h2><p>Renovações nos próximos 30 dias</p></div><button class="icon-button" aria-label="Ver alunos" data-page="students">${icon('arrowRight', 18)}</button></div>
        <div class="schedule-list">${upcoming || '<p class="empty-inline">Nenhum contrato próximo do vencimento.</p>'}</div>
        <button class="text-button" data-page="students">Ver alunos ${icon('arrowRight', 15)}</button>
      </article>
    </section>
    <section class="card attention-card">
      <div class="card-heading"><div><h2>Precisam da sua atenção</h2><p>Pendências calculadas a partir dos seus dados</p></div><button class="text-button" data-page="finance">Financeiro ${icon('arrowRight', 15)}</button></div>
      <div class="attention-items">${attentionRows}</div>
    </section>`;
}

function filteredStudents() {
  const query = searchValue.trim().toLocaleLowerCase('pt-BR');
  return (pageData?.items ?? []).filter((student) =>
    !query || `${student.name} ${student.email}`.toLocaleLowerCase('pt-BR').includes(query),
  );
}

function studentRows() {
  const results = filteredStudents();
  if (!results.length) return '<tr><td class="empty-state" colspan="4">Nenhum aluno encontrado.</td></tr>';
  return results.map((student) => {
    const status = student.active ? 'Ativo' : 'Inativo';
    return `<tr>
      <td><div class="table-person">${studentAvatar(student)}<span><strong>${escapeHTML(student.name)}</strong><small>${escapeHTML(student.email)}</small></span></div></td>
      <td>${escapeHTML(student.plan ? cycleLabel(student.plan) : 'Sem contrato')}</td>
      <td><span class="status-badge ${student.active ? 'ativo' : 'inativo'}"><i></i>${status}</span></td>
      <td><span class="table-date">${dateLabel(student.createdAt)}</span></td>
    </tr>`;
  }).join('');
}

function studentPage(data) {
  const action = `<button class="primary-button" data-action="add-student">${icon('plus', 17)} Novo aluno</button>`;
  return `${pageHeading('Alunos', 'Acompanhe e organize cada etapa da jornada dos seus alunos.', action)}
    ${connectionNote()}
    <section class="metrics-grid student-metrics">
      ${metricCard({ label: 'Total de alunos', value: data.allCount, note: 'cadastros não anonimizados', change: 'Banco de dados', iconName: 'students', color: 'icon-blue', arrow: false })}
      ${metricCard({ label: 'Alunos ativos', value: data.activeCount, note: 'com cadastro ativo', change: 'Status atual', iconName: 'check', color: 'icon-green', arrow: false })}
      ${metricCard({ label: 'Novos neste mês', value: data.newThisMonth, note: 'criados neste mês', change: 'Dados registrados', iconName: 'activity', color: 'icon-violet', arrow: false })}
    </section>
    <section class="card table-card">
      <div class="table-toolbar"><div><h2>Alunos</h2><p>Registros cadastrados para sua conta.</p></div></div>
      <div class="student-tabs" role="group" aria-label="Filtrar por status">${['Todos', 'Ativo', 'Inativo'].map((filter) => `<button class="student-tab ${studentFilter === filter ? 'selected' : ''}" data-student-filter="${filter}">${filter}${filter === 'Todos' ? `<span>${data.allCount}</span>` : ''}</button>`).join('')}</div>
      <div class="table-scroll"><table><thead><tr><th>ALUNO</th><th>CONTRATO MAIS RECENTE</th><th>STATUS</th><th>CADASTRADO</th></tr></thead><tbody>${studentRows()}</tbody></table></div>
      <div class="table-footer"><span>Exibindo <strong>${filteredStudents().length}</strong> de <strong>${data.total}</strong> neste filtro · ${data.pageSize} por página</span><div class="pagination"><button aria-label="Página anterior" data-student-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>${icon('arrowLeft', 16)}</button><button class="page-number">${data.page}</button><button aria-label="Próxima página" data-student-page="${data.page + 1}" ${data.page * data.pageSize >= data.total ? 'disabled' : ''}>${icon('arrowRight', 16)}</button></div></div>
    </section>`;
}

function workoutCards(data) {
  const query = searchValue.trim().toLocaleLowerCase('pt-BR');
  const results = data.items.filter((workout) => `${workout.title} ${workout.student.name} ${workout.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(query));
  if (!results.length) return '<div class="empty-card">Nenhum treino encontrado para esta busca.</div>';
  const reviewThreshold = Date.now() - 30 * 86400000;
  return results.map((workout) => {
    const needsReview = new Date(workout.updatedAt).getTime() < reviewThreshold;
    return `<article class="card workout-card">
      <div class="workout-card-top"><span class="workout-icon">${icon('dumbbell', 20)}</span></div>
      <span class="workout-state ${needsReview ? 'state-review' : 'state-active'}"><i></i>${needsReview ? 'Precisa de revisão' : 'Ativo'}</span>
      <h2>${escapeHTML(workout.title)}</h2><p class="workout-details">${escapeHTML(workout.description ?? 'Sem descrição')}</p>
      <div class="workout-student">${studentAvatar({ id: workout.student.id, name: workout.student.name })}<span>${escapeHTML(workout.student.name)}</span><span class="workout-updated">${relativeDate(workout.updatedAt)}</span></div>
    </article>`;
  }).join('');
}

function workoutsPage(data) {
  return `${pageHeading('Treinos', 'Consulte os treinos ativos e as atualizações dos alunos.')}
    ${connectionNote()}
    <section class="metrics-grid">
      ${metricCard({ label: 'Treinos ativos', value: data.total, note: 'registros ativos', change: 'Banco de dados', iconName: 'dumbbell', color: 'icon-blue', arrow: false })}
      ${metricCard({ label: 'Atualizados recentemente', value: data.active, note: 'atualizados nos últimos 30 dias', change: 'Últimos 30 dias', iconName: 'activity', color: 'icon-green', arrow: false })}
      ${metricCard({ label: 'Precisam de revisão', value: data.needsReview, note: 'sem atualização há mais de 30 dias', change: 'Atenção recomendada', iconName: 'clock', color: 'icon-amber', arrow: false })}
    </section>
    <div class="section-title-row"><div><h2>Treinos ativos</h2><p>Ordenados pela atualização mais recente</p></div></div>
    <section class="workouts-grid">${workoutCards(data)}</section>`;
}

function financePage(data) {
  const maxValue = Math.max(...data.chart.map((month) => month.received), 1);
  const bars = data.chart.map((month, index) => {
    const height = month.received === 0 ? 0 : Math.max(4, Math.round((month.received / maxValue) * 86));
    const current = index === data.chart.length - 1;
    return `<div class="chart-column"><span class="chart-tooltip">${money(month.received)}</span><div class="bar-track"><span class="bar ${current ? 'current' : ''}" style="height:${height}%"></span></div><span class="chart-label ${current ? 'current-label' : ''}">${escapeHTML(month.label)}</span></div>`;
  }).join('');
  const statusLabels = { CONFIRMED: ['Recebido', 'ativo'], PENDING: ['Pendente', 'pendente'], FAILED: ['Falhou', 'inativo'], CANCELLED: ['Cancelado', 'inativo'] };
  const query = searchValue.trim().toLocaleLowerCase('pt-BR');
  const rows = data.transactions.filter((item) =>
    `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(query),
  ).map((item) => {
    const [label, style] = statusLabels[item.status] ?? ['Desconhecido', 'inativo'];
    return `<tr>
      <td><div class="table-person">${avatar(initials(item.name), colorFor(item.id))}<span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small></span></div></td>
      <td>${dateLabel(item.date)}</td><td><strong class="money-cell">${money(item.value)}</strong></td>
      <td><span class="status-badge ${style}"><i></i>${label}</span></td></tr>`;
  }).join('');
  const totalReceived = data.chart.reduce((total, month) => total + month.received, 0);

  return `${pageHeading('Financeiro', 'Recebimentos e pagamentos registrados no seu banco de dados.')}
    ${connectionNote()}
    <section class="metrics-grid finance-metrics">
      ${metricCard({ label: 'Recebido neste mês', value: money(data.monthlyRevenue), note: 'pagamentos confirmados', change: 'Mês atual', iconName: 'wallet', color: 'icon-green', arrow: false })}
      ${metricCard({ label: 'A receber', value: money(data.receivable), note: `${data.overdueCount} pagamento(s) em atraso`, change: 'Pendentes e falhos', iconName: 'clock', color: 'icon-amber', arrow: false })}
      ${metricCard({ label: 'Receita recorrente', value: money(data.recurringRevenue), note: 'contratos vigentes', change: 'Valor mensal', iconName: 'activity', color: 'icon-violet', arrow: false })}
    </section>
    <article class="card finance-chart-card"><div class="card-heading"><div><h2>Receitas ao longo do tempo</h2><p>Pagamentos confirmados nos últimos 6 meses</p></div></div>
      <div class="chart-wrap finance-chart"><div class="chart-y-labels">${[maxValue, maxValue * 2 / 3, maxValue / 3, 0].map((value) => `<span>${value === 0 ? '0' : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</span>`).join('')}</div><div class="chart-plot"><div class="chart-grid-lines"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${bars || '<p class="empty-inline">Sem movimentações neste período.</p>'}</div></div></div>
      <div class="chart-footer"><span class="chart-legend"><i></i> Recebido</span><span class="chart-total">Total no período <strong>${money(totalReceived)}</strong></span></div>
    </article>
    <section class="card table-card transactions-card"><div class="table-toolbar"><div><h2>Últimas movimentações</h2><p>Pagamentos recentes cadastrados.</p></div></div>
      <div class="table-scroll"><table><thead><tr><th>ALUNO / DESCRIÇÃO</th><th>DATA</th><th>VALOR</th><th>STATUS</th></tr></thead><tbody>${rows || '<tr><td class="empty-state" colspan="4">Nenhuma movimentação encontrada.</td></tr>'}</tbody></table></div>
    </section>`;
}

const pages = { overview: dashboard, students: studentPage, workouts: workoutsPage, finance: financePage };
const titles = { overview: 'Visão geral', students: 'Alunos', workouts: 'Treinos', finance: 'Financeiro' };
const endpoints = { overview: '/api/dashboard', students: '/api/students', workouts: '/api/workouts', finance: '/api/finance' };

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      session = null;
      currentUser = null;
      loginMessage = 'Sua sessão expirou. Entre novamente.';
    }
    throw new Error(body.error ?? 'Não foi possível carregar os dados.');
  }
  return body;
}

async function navigate(page) {
  const loadId = ++pageLoadId;
  activePage = pages[page] ? page : 'overview';
  pageData = null;
  pageError = null;
  loading = true;
  render();
  const query = activePage === 'students'
    ? `?page=${studentPageNumber}&status=${encodeURIComponent(studentFilter)}`
    : '';
  try {
    const result = await api(`${endpoints[activePage]}${query}`);
    if (loadId !== pageLoadId) return;
    pageData = result;
  } catch (error) {
    if (loadId !== pageLoadId) return;
    pageError = error.message;
  } finally {
    if (loadId === pageLoadId) {
      loading = false;
      render();
    }
  }
}

function render() {
  if (!session || !currentUser) {
    renderLogin();
    return;
  }
  const page = loading
    ? '<div class="card loading-card" role="status">Carregando dados do Supabase...</div>'
    : pageError
      ? `<div class="card error-card" role="alert"><strong>Não foi possível carregar esta tela.</strong><p>${escapeHTML(pageError)}</p><button class="outline-button" data-action="retry">Tentar novamente</button></div>`
      : pages[activePage](pageData);
  app.innerHTML = `${sidebar()}
    <main class="main-content"><header class="topbar"><button class="icon-button mobile-menu" aria-label="Abrir menu" data-action="toggle-menu">${icon('menu')}</button>
      <div class="breadcrumbs">Início <span>/</span> <strong>${titles[activePage]}</strong></div>
      <div class="topbar-actions"><label class="search-box">${icon('search', 17)}<input id="global-search" type="search" placeholder="Buscar nesta tela..." aria-label="Buscar nesta tela" value="${escapeHTML(searchValue)}"><kbd>⌘ K</kbd></label><button class="icon-button profile-menu" aria-label="Sair da conta" title="Sair" data-action="sign-out">${icon('ellipsis')}</button></div>
    </header><div class="page-content">${page}<footer class="footer">Feito para cuidar melhor de quem cuida. <span>Forma <b>·</b> Gestão do Personal</span></footer></div></main><div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;
  bindEvents();
}

function renderLogin(message = loginMessage) {
  loginMessage = message;
  app.innerHTML = `<main class="login-page"><section class="login-card">
    <a class="brand login-brand" href="#"><span class="brand-mark">${icon('activity', 20)}</span><span>forma<span class="brand-dot">.</span></span></a>
    <p class="eyebrow">GESTÃO DO PERSONAL</p><h1>Acesse sua conta</h1><p class="login-subtitle">Entre para consultar os dados do seu negócio.</p>
    ${loginMessage ? `<div class="login-error" role="alert">${escapeHTML(loginMessage)}</div>` : ''}
    <form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="username" required placeholder="voce@email.com"></label><label>Senha<input name="password" type="password" autocomplete="current-password" required placeholder="Sua senha"></label><button class="primary-button login-submit" type="submit">Entrar</button></form>
    <p class="login-help">Use a conta já cadastrada no Supabase Auth e vinculada ao seu cadastro de personal.</p>
  </section><p class="login-footer">Acesso protegido pelo Supabase Auth</p></main>`;
  app.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = app.querySelector('.login-error');
    button.disabled = true;
    button.textContent = 'Entrando...';
    if (errorBox) errorBox.remove();
    const formData = new FormData(form);
    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email')).trim(),
        password: String(formData.get('password')),
      }));
    } catch {
      error = new Error('Não foi possível conectar ao Supabase Auth. Verifique a conexão e tente novamente.');
    }
    if (error) {
      button.disabled = false;
      button.textContent = 'Entrar';
      app.querySelector('.login-card').insertAdjacentHTML('afterbegin', `<div class="login-error" role="alert">${escapeHTML(error.message)}</div>`);
      return;
    }
    session = data.session;
    try {
      const profile = await api('/api/me');
      currentUser = profile.user;
      await navigate('overview');
    } catch (profileError) {
      button.disabled = false;
      button.textContent = 'Entrar';
      app.querySelector('.login-card').insertAdjacentHTML('afterbegin', `<div class="login-error" role="alert">${escapeHTML(profileError.message)}</div>`);
    }
  });
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
}

function addStudentModal() {
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header"><div><p class="eyebrow">SUA EQUIPE</p><h2 id="modal-title">Adicionar aluno</h2><p>Preencha os dados para incluir um novo aluno.</p></div><button class="icon-button" aria-label="Fechar" data-action="close-modal">${icon('close')}</button></div>
    <form id="student-form"><label>Nome completo<input name="name" required maxlength="120" placeholder="Ex.: Ana Silva"></label><label>E-mail<input name="email" type="email" required maxlength="254" placeholder="ana@email.com"></label><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="outline-button" data-action="close-modal">Cancelar</button><button type="submit" class="primary-button">${icon('plus', 16)} Salvar aluno</button></div><p class="modal-disclaimer">O cadastro será salvo no banco de dados.</p></form>
  </section></div>`;
  root.querySelector('input[name="name"]').focus();
}

function bindEvents() {
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    searchValue = '';
    if (button.dataset.page === 'students') {
      studentPageNumber = 1;
      studentFilter = 'Todos';
    }
    document.querySelector('#sidebar')?.classList.remove('open');
    navigate(button.dataset.page);
  }));
  app.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
  app.querySelectorAll('[data-action="toggle-menu"]').forEach((button) => button.addEventListener('click', () => document.querySelector('#sidebar')?.classList.toggle('open')));
  app.querySelectorAll('[data-action="add-student"]').forEach((button) => button.addEventListener('click', addStudentModal));
  app.querySelectorAll('[data-student-filter]').forEach((button) => button.addEventListener('click', () => {
    studentFilter = button.dataset.studentFilter;
    studentPageNumber = 1;
    navigate('students');
  }));
  app.querySelectorAll('[data-student-page]').forEach((button) => button.addEventListener('click', () => {
    studentPageNumber = Number(button.dataset.studentPage);
    navigate('students');
  }));
  app.querySelectorAll('[data-action="retry"]').forEach((button) => button.addEventListener('click', () => navigate(activePage)));
  app.querySelectorAll('[data-action="sign-out"]').forEach((button) => button.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast('Não foi possível encerrar a sessão. Tente novamente.');
      return;
    }
    session = null;
    currentUser = null;
    pageData = null;
    renderLogin();
  }));
  document.querySelector('#global-search')?.addEventListener('input', (event) => {
    searchValue = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const search = document.querySelector('#global-search');
    search?.focus();
    search?.setSelectionRange(cursor, cursor);
  });

  document.querySelector('#modal-root')?.addEventListener('click', (event) => {
    if (event.target.dataset.action === 'close-modal') document.querySelector('#modal-root').innerHTML = '';
  });
  document.querySelector('#modal-root')?.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'student-form') return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    const error = form.querySelector('.modal-error');
    button.disabled = true;
    button.textContent = 'Salvando...';
    error.textContent = '';
    void api('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        name: String(data.get('name')).trim(),
        email: String(data.get('email')).trim(),
      }),
    }).then(() => {
      document.querySelector('#modal-root').innerHTML = '';
      studentFilter = 'Todos';
      studentPageNumber = 1;
      searchValue = '';
      return navigate('students').then(() => showToast('Aluno salvo no banco de dados.'));
    }).catch((saveError) => {
      error.textContent = saveError.message;
      button.disabled = false;
      button.innerHTML = `${icon('plus', 16)} Salvar aluno`;
    });
  });
}

async function start() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Não foi possível obter a configuração do servidor.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.publishableKey) {
      throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env.');
    }
    supabase = createClient(config.supabaseUrl, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: window.sessionStorage,
        storageKey: 'forma.supabase.auth',
      },
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    session = data.session;
    if (!session) {
      renderLogin();
      return;
    }
    const profile = await api('/api/me');
    currentUser = profile.user;
    await navigate('overview');
  } catch (error) {
    renderLogin(error.message || 'Não foi possível conectar ao servidor.');
  }
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#global-search')?.focus();
  }
  if (event.key === 'Escape') {
    document.querySelector('#modal-root').innerHTML = '';
    document.querySelector('#sidebar')?.classList.remove('open');
  }
});

start();
