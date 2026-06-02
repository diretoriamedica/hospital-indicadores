// ── ESTADO GLOBAL ────────────────────────────────────────────────────────────
const App = {
  dados: null,
  filtroUnidade: 'todas',
  filtroMes: '',
  charts: {},
};

// ── CARREGAR DADOS ────────────────────────────────────────────────────────────
async function carregarDados() {
  // Priorizar localStorage (dados inseridos pelo usuário)
  const local = localStorage.getItem('hospital_indicadores');
  if (local) {
    try {
      App.dados = JSON.parse(local);
      return App.dados;
    } catch {}
  }
  // Fallback: arquivo JSON do projeto
  try {
    const r = await fetch('data/dados.json');
    App.dados = await r.json();
  } catch (e) {
    App.dados = {
      unidades: [
        'HCP - Hospital Casa de Portugal',
        'HCE - Hospital Casa Evangélico',
        'HCIG - Hospital Casa Ilha do Governador',
        'HCSB - Hospital Casa São Bernardo',
        'HCSC - Hospital Casa Santa Cruz',
        'HCRB - Hospital Casa Rio Botafogo',
        'HCRL - Hospital Casa Rio Laranjeiras',
        'HCM - Hospital Casa Mensana'
      ],
      registros: []
    };
  }
  return App.dados;
}

// ── FILTRAR REGISTROS ─────────────────────────────────────────────────────────
function filtrar() {
  if (!App.dados) return [];
  return App.dados.registros.filter(r => {
    const okUnidade = App.filtroUnidade === 'todas' || r.unidade === App.filtroUnidade;
    const okMes     = !App.filtroMes || r.mes === App.filtroMes;
    return okUnidade && okMes;
  });
}

// ── CALCULAR MÉDIAS ───────────────────────────────────────────────────────────
function media(registros, campo) {
  const vals = registros.map(r => parseFloat(r[campo])).filter(v => !isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}

function ultimo(registros, campo) {
  const vals = registros.filter(r => r[campo] !== undefined && r[campo] !== '').reverse();
  if (!vals.length) return null;
  return parseFloat(vals[0][campo]);
}

// ── AVALIAR META ──────────────────────────────────────────────────────────────
function avaliarMeta(campo, valor) {
  if (valor === null) return 'nd';

  // Taxa de Ocupação: lógica específica (meta 85–90%, alerta <70% ou >95%, crítico <60%)
  if (campo === 'taxa_ocupacao') {
    if (valor < 60 || valor > 95) return 'critico';
    if (valor >= 85 && valor <= 90) return 'ok';
    return 'alerta';
  }

  const metas = {
    tmp:               { ok: [0, 5],    critico: [8, 999] },
    taxa_mortalidade:  { ok: [0, 3],    critico: [6, 999] },
    taxa_reinternacao: { ok: [0, 10],   critico: [15, 999] },
    taxa_iras:         { ok: [0, 3],    critico: [6, 999] },
    absenteismo:       { ok: [0, 3],    critico: [5, 999] },
    eventos_adversos:  { ok: [1, 9999], critico: [-1, 0] },
  };
  const m = metas[campo];
  if (!m) return 'nd';
  if (valor >= m.ok[0] && valor <= m.ok[1]) return 'ok';
  if (valor >= m.critico[0] && valor <= m.critico[1]) return 'critico';
  return 'alerta';
}

function statusLabel(s) {
  return { ok:'✓ Dentro da meta', alerta:'⚠ Atenção', critico:'✕ Crítico', nd:'Sem dados' }[s] || 'Sem dados';
}
function statusClass(s) {
  return { ok:'status-ok', alerta:'status-alerta', critico:'status-critico', nd:'status-nd' }[s] || 'status-nd';
}

// ── RENDERIZAR KPI CARDS ──────────────────────────────────────────────────────
function renderKPIs(registros) {
  const kpis = [
    { campo:'taxa_ocupacao',    label:'Taxa de Ocupação',      unidade:'%', tipo:'desc',  meta:'Meta: 85–90%' },
    { campo:'tmp',              label:'Tempo Médio Permanência',unidade:' dias', tipo:'desc', meta:'Meta: ≤ 5 dias' },
    { campo:'taxa_mortalidade', label:'Taxa de Mortalidade',   unidade:'%', tipo:'desc',  meta:'Meta: < 3%' },
    { campo:'taxa_reinternacao',label:'Reinternação 30 dias',  unidade:'%', tipo:'desc',  meta:'Meta: < 10%' },
    { campo:'taxa_iras',        label:'Taxa IRAS',             unidade:'‰', tipo:'desc',  meta:'Meta: < 3‰' },
    { campo:'absenteismo',      label:'Absenteísmo',           unidade:'%', tipo:'desc',  meta:'Meta: < 3%' },
    { campo:'volume_cirurgias', label:'Cirurgias Realizadas',  unidade:'',  tipo:'desc',  meta:'Volume total' },
    { campo:'eventos_adversos', label:'Eventos Adversos',      unidade:'',  tipo:'desc',  meta:'Notificados' },
  ];

  const container = document.getElementById('kpi-cards');
  if (!container) return;
  container.innerHTML = '';

  kpis.forEach(k => {
    const val = ultimo(registros, k.campo);
    const status = avaliarMeta(k.campo, val);
    const display = val !== null ? val.toFixed(1) + k.unidade : '—';
    container.innerHTML += `
      <div class="kpi-card ${k.tipo}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${display}</div>
        <div class="kpi-meta"><span class="${statusClass(status)}">${statusLabel(status)}</span></div>
        <div class="kpi-sub" style="margin-top:6px;font-size:10.5px">${k.meta}</div>
      </div>`;
  });
}

// ── RENDERIZAR TABELA HISTÓRICO ───────────────────────────────────────────────
function renderTabela(registros) {
  const tbody = document.getElementById('tabela-body');
  if (!tbody) return;

  if (!registros.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--cinza-4)">Nenhum dado registrado ainda. Acesse "Entrada de Dados" para começar.</td></tr>`;
    return;
  }

  const sorted = [...registros].sort((a,b) => b.mes.localeCompare(a.mes));
  tbody.innerHTML = sorted.slice(0,20).map(r => {
    const st = avaliarMeta('taxa_ocupacao', parseFloat(r.taxa_ocupacao));
    return `
      <tr>
        <td>${r.mes || '—'}</td>
        <td>${r.unidade || '—'}</td>
        <td class="td-valor">${r.taxa_ocupacao !== undefined && r.taxa_ocupacao !== '' ? r.taxa_ocupacao+'%' : '—'}</td>
        <td class="td-valor">${r.tmp !== undefined && r.tmp !== '' ? r.tmp+' d' : '—'}</td>
        <td class="td-valor">${r.internacoes || '—'}</td>
        <td class="td-valor">${r.taxa_mortalidade !== undefined && r.taxa_mortalidade !== '' ? r.taxa_mortalidade+'%' : '—'}</td>
        <td class="td-valor">${r.taxa_reinternacao !== undefined && r.taxa_reinternacao !== '' ? r.taxa_reinternacao+'%' : '—'}</td>
        <td class="td-valor">${r.taxa_iras !== undefined && r.taxa_iras !== '' ? r.taxa_iras+'‰' : '—'}</td>
        <td class="td-valor">${r.absenteismo !== undefined && r.absenteismo !== '' ? r.absenteismo+'%' : '—'}</td>
        <td><span class="status ${statusClass(st)}">${statusLabel(st)}</span></td>
      </tr>`;
  }).join('');
}

// ── GRÁFICO: OCUPAÇÃO NO TEMPO ────────────────────────────────────────────────
function renderChartOcupacao(registros) {
  const ctx = document.getElementById('chart-ocupacao');
  if (!ctx) return;

  // Agrupar por mês (média das unidades)
  const porMes = {};
  registros.forEach(r => {
    const v = parseFloat(r.taxa_ocupacao);
    if (!isNaN(v)) {
      if (!porMes[r.mes]) porMes[r.mes] = [];
      porMes[r.mes].push(v);
    }
  });
  const meses = Object.keys(porMes).sort();
  const valores = meses.map(m => (porMes[m].reduce((a,b)=>a+b,0)/porMes[m].length).toFixed(1));

  if (App.charts.ocupacao) App.charts.ocupacao.destroy();
  App.charts.ocupacao = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses,
      datasets: [{
        label: 'Taxa de Ocupação (%)',
        data: valores,
        borderColor: '#2272B8',
        backgroundColor: 'rgba(34,114,184,.1)',
        borderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: .35,
      }, {
        label: 'Meta (90%)',
        data: meses.map(() => 90),
        borderColor: '#D94040',
        borderDash: [6,3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      }]
    },
    options: chartOptions('Taxa de Ocupação por Mês (%)'),
  });
}

// ── GRÁFICO: MORTALIDADE + IRAS ───────────────────────────────────────────────
function renderChartQualidade(registros) {
  const ctx = document.getElementById('chart-qualidade');
  if (!ctx) return;

  const porMes = {};
  registros.forEach(r => {
    if (!porMes[r.mes]) porMes[r.mes] = { mort:[], iras:[] };
    const m = parseFloat(r.taxa_mortalidade), i = parseFloat(r.taxa_iras);
    if (!isNaN(m)) porMes[r.mes].mort.push(m);
    if (!isNaN(i)) porMes[r.mes].iras.push(i);
  });
  const meses = Object.keys(porMes).sort();
  const mort  = meses.map(m => porMes[m].mort.length ? (porMes[m].mort.reduce((a,b)=>a+b)/porMes[m].mort.length).toFixed(2) : null);
  const iras  = meses.map(m => porMes[m].iras.length ? (porMes[m].iras.reduce((a,b)=>a+b)/porMes[m].iras.length).toFixed(2) : null);

  if (App.charts.qualidade) App.charts.qualidade.destroy();
  App.charts.qualidade = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses,
      datasets: [
        { label: 'Mortalidade (%)', data: mort, borderColor: '#D94040', backgroundColor: 'rgba(217,64,64,.08)', borderWidth: 2, pointRadius: 4, fill: true, tension:.35 },
        { label: 'IRAS (‰)',        data: iras, borderColor: '#1A7A45', backgroundColor: 'rgba(26,122,69,.08)',  borderWidth: 2, pointRadius: 4, fill: true, tension:.35 },
      ]
    },
    options: chartOptions('Mortalidade (%) e IRAS (‰)'),
  });
}

// ── GRÁFICO: COMPARATIVO POR UNIDADE ─────────────────────────────────────────
function renderChartUnidades(registros) {
  const ctx = document.getElementById('chart-unidades');
  if (!ctx) return;

  const unidades = App.dados ? App.dados.unidades : [];
  const campos = ['taxa_ocupacao','taxa_mortalidade','taxa_reinternacao','absenteismo'];
  const labels = ['Ocup. (%)','Mortalidade (%)','Reinternação (%)','Absenteísmo (%)'];
  const colors = ['#2272B8','#D94040','#A07000','#5C2D91'];

  const datasets = campos.map((campo, idx) => ({
    label: labels[idx],
    data: unidades.map(u => {
      const regs = registros.filter(r => r.unidade === u);
      const m = media(regs, campo);
      return m !== null ? parseFloat(m.toFixed(1)) : 0;
    }),
    backgroundColor: colors[idx] + '99',
    borderColor: colors[idx],
    borderWidth: 1.5,
  }));

  if (App.charts.unidades) App.charts.unidades.destroy();
  App.charts.unidades = new Chart(ctx, {
    type: 'bar',
    data: { labels: unidades, datasets },
    options: {
      ...chartOptions('Comparativo por Unidade'),
      scales: {
        y: { beginAtZero: true, grid: { color: '#E8EDF3' }, ticks: { font: { family: 'DM Mono', size:11 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size:12 } } },
      }
    }
  });
}

// ── GRÁFICO: TMP POR UNIDADE ──────────────────────────────────────────────────
function renderChartTMP(registros) {
  const ctx = document.getElementById('chart-tmp');
  if (!ctx) return;
  const unidades = App.dados ? App.dados.unidades : [];
  const vals = unidades.map(u => {
    const regs = registros.filter(r => r.unidade === u);
    const m = media(regs, 'tmp');
    return m !== null ? parseFloat(m.toFixed(1)) : 0;
  });

  if (App.charts.tmp) App.charts.tmp.destroy();
  App.charts.tmp = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: unidades,
      datasets: [{
        label: 'TMP (dias)',
        data: vals,
        backgroundColor: vals.map(v => v <= 5 ? 'rgba(26,122,69,.7)' : v <= 8 ? 'rgba(160,112,0,.7)' : 'rgba(217,64,64,.7)'),
        borderRadius: 6,
        borderWidth: 0,
      }]
    },
    options: {
      ...chartOptions('Tempo Médio de Permanência (dias)'),
      scales: {
        y: { beginAtZero: true, grid: { color: '#E8EDF3' }, ticks: { font: { family: 'DM Mono', size:11 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size:12 } } },
      }
    }
  });
}

function chartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position:'bottom', labels: { font: { family:'DM Sans', size:11 }, boxWidth:10, padding:14 } },
      title: { display: false },
      tooltip: { bodyFont: { family:'DM Sans' }, titleFont: { family:'DM Sans', weight:'600' } },
    },
    scales: {
      y: { beginAtZero: false, grid: { color: '#E8EDF3' }, ticks: { font: { family:'DM Mono', size:11 } } },
      x: { grid: { display:false }, ticks: { font: { family:'DM Sans', size:11 } } },
    }
  };
}

// ── PROGRESSO DE IMPLANTAÇÃO ──────────────────────────────────────────────────
function renderProgresso(registros) {
  const total = App.dados ? App.dados.unidades.length : 4;
  // Camadas com pelo menos 1 registro cada
  const camadas = [
    { id:'desc',  label:'Descritivos (10 ind.)',  color:'pf-azul',    campos:['taxa_ocupacao','tmp','internacoes','taxa_mortalidade','taxa_reinternacao'] },
    { id:'diag',  label:'Diagnóstico (7 análises)',color:'pf-verde',   campos:['causa_reinternacao_status'] },
    { id:'pred',  label:'Preditivos (8 modelos)', color:'pf-amarelo', campos:['pred_ocupacao_status'] },
    { id:'presc', label:'Prescritivos (8 ações)', color:'pf-roxo',    campos:['presc_leitos_status'] },
  ];

  const el = document.getElementById('progresso-camadas');
  if (!el) return;

  el.innerHTML = camadas.map(c => {
    // Para descritivos, conta unidades que têm pelo menos 1 campo preenchido
    const unidadesComDados = (App.dados ? App.dados.unidades : []).filter(u =>
      registros.some(r => r.unidade === u && c.campos.some(f => r[f] !== undefined && r[f] !== ''))
    );
    const pct = total > 0 ? Math.round((unidadesComDados.length / total) * 100) : 0;
    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;font-weight:500">${c.label}</span>
          <span style="font-size:12px;color:var(--cinza-4);font-family:'DM Mono'">${unidadesComDados.length}/${total} unidades</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${c.color}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ── POPULAR FILTROS ───────────────────────────────────────────────────────────
function popularFiltros() {
  const selUni = document.getElementById('filtro-unidade');
  const selMes = document.getElementById('filtro-mes');
  if (!App.dados || !selUni) return;

  App.dados.unidades.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    selUni.appendChild(opt);
  });

  // Meses dos registros
  const meses = [...new Set(App.dados.registros.map(r => r.mes))].sort().reverse();
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    selMes.appendChild(opt);
  });
}

// ── RENDER GERAL ─────────────────────────────────────────────────────────────
function renderTudo() {
  const registros = filtrar();
  renderKPIs(registros);
  renderTabela(registros);
  renderChartOcupacao(registros);
  renderChartQualidade(registros);
  renderChartUnidades(registros);
  renderChartTMP(registros);
  renderProgresso(registros);

  // Contadores no header
  const el = document.getElementById('total-registros');
  if (el) el.textContent = App.dados ? App.dados.registros.length : 0;
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await carregarDados();
  popularFiltros();
  renderTudo();

  document.getElementById('filtro-unidade')?.addEventListener('change', e => {
    App.filtroUnidade = e.target.value; renderTudo();
  });
  document.getElementById('filtro-mes')?.addEventListener('change', e => {
    App.filtroMes = e.target.value; renderTudo();
  });
});
