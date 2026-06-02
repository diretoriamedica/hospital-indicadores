// ── ESTADO ────────────────────────────────────────────────────────────────────
const EntradaApp = { dados: null };

// ── CARREGAR / SALVAR ─────────────────────────────────────────────────────────
async function carregarDadosEntrada() {
  try {
    const r = await fetch('data/dados.json');
    EntradaApp.dados = await r.json();
  } catch {
    EntradaApp.dados = { unidades: ['Unidade 1','Unidade 2','Unidade 3','Unidade 4'], registros: [] };
  }
  popularSelectUnidade();
  atualizarContador();
}

function popularSelectUnidade() {
  const sel = document.getElementById('input-unidade');
  if (!sel || !EntradaApp.dados) return;
  EntradaApp.dados.unidades.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    sel.appendChild(opt);
  });
}

// ── SALVAR REGISTRO ───────────────────────────────────────────────────────────
function salvarRegistro(form) {
  const unidade = document.getElementById('input-unidade')?.value;
  const mes     = document.getElementById('input-mes')?.value;

  if (!unidade || !mes) {
    showToast('Selecione a unidade e o mês antes de salvar.', 'error');
    return;
  }

  // Verificar se já existe registro para unidade+mês → atualizar
  const existeIdx = EntradaApp.dados.registros.findIndex(r => r.unidade === unidade && r.mes === mes);

  const campos = [
    'taxa_ocupacao','tmp','internacoes','volume_cirurgias',
    'taxa_mortalidade','taxa_reinternacao','taxa_iras','absenteismo','eventos_adversos',
    'causa_reinternacao_status','gargalo_pa_status','desperdicio_status','iras_higiene_status',
    'pred_ocupacao_status','pred_reinternacao_status','pred_demanda_pa_status',
    'pred_insumos_status','pred_ews_status','pred_absenteismo_status',
    'presc_leitos_status','presc_escala_status','presc_compras_status','presc_alta_status',
    'obs_geral',
  ];

  const registro = { unidade, mes };
  campos.forEach(c => {
    const el = document.getElementById('f-' + c);
    if (el) registro[c] = el.value;
  });
  registro.atualizado_em = new Date().toISOString();

  if (existeIdx >= 0) {
    EntradaApp.dados.registros[existeIdx] = registro;
    showToast(`Registro atualizado: ${unidade} — ${mes}`, 'success');
  } else {
    EntradaApp.dados.registros.push(registro);
    showToast(`Registro salvo: ${unidade} — ${mes}`, 'success');
  }

  // Salvar no localStorage como fallback (arquivo real via backend)
  localStorage.setItem('hospital_indicadores', JSON.stringify(EntradaApp.dados));
  atualizarContador();
  renderHistoricoEntrada();
}

// ── CARREGAR REGISTRO EXISTENTE ───────────────────────────────────────────────
function carregarRegistroExistente() {
  const unidade = document.getElementById('input-unidade')?.value;
  const mes     = document.getElementById('input-mes')?.value;
  if (!unidade || !mes) return;

  // Tenta localStorage primeiro
  const local = localStorage.getItem('hospital_indicadores');
  if (local) {
    try { EntradaApp.dados = JSON.parse(local); } catch {}
  }

  const reg = EntradaApp.dados?.registros.find(r => r.unidade === unidade && r.mes === mes);
  if (!reg) return;

  const campos = [
    'taxa_ocupacao','tmp','internacoes','volume_cirurgias',
    'taxa_mortalidade','taxa_reinternacao','taxa_iras','absenteismo','eventos_adversos',
    'causa_reinternacao_status','gargalo_pa_status','desperdicio_status','iras_higiene_status',
    'pred_ocupacao_status','pred_reinternacao_status','pred_demanda_pa_status',
    'pred_insumos_status','pred_ews_status','pred_absenteismo_status',
    'presc_leitos_status','presc_escala_status','presc_compras_status','presc_alta_status',
    'obs_geral',
  ];
  campos.forEach(c => {
    const el = document.getElementById('f-' + c);
    if (el && reg[c] !== undefined) el.value = reg[c];
  });
  showToast(`Dados carregados: ${unidade} — ${mes}`, 'success');
}

// ── EXPORTAR JSON ─────────────────────────────────────────────────────────────
function exportarJSON() {
  const local = localStorage.getItem('hospital_indicadores');
  const dados = local ? JSON.parse(local) : EntradaApp.dados;
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'dados.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('dados.json exportado — substitua o arquivo na pasta data/', 'success');
}

// ── IMPORTAR JSON ─────────────────────────────────────────────────────────────
function importarJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      EntradaApp.dados = JSON.parse(e.target.result);
      localStorage.setItem('hospital_indicadores', e.target.result);
      atualizarContador();
      renderHistoricoEntrada();
      showToast('Arquivo importado com sucesso!', 'success');
    } catch {
      showToast('Erro ao ler o arquivo JSON.', 'error');
    }
  };
  reader.readAsText(file);
}

// ── HISTÓRICO (tabela rápida) ─────────────────────────────────────────────────
function renderHistoricoEntrada() {
  const tbody = document.getElementById('hist-body');
  if (!tbody) return;

  const local = localStorage.getItem('hospital_indicadores');
  const dados = local ? JSON.parse(local) : EntradaApp.dados;
  const regs  = dados?.registros || [];

  if (!regs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--cinza-4)">Nenhum registro ainda.</td></tr>`;
    return;
  }

  const sorted = [...regs].sort((a,b) => b.mes.localeCompare(a.mes));
  tbody.innerHTML = sorted.slice(0,10).map(r => `
    <tr>
      <td>${r.mes || '—'}</td>
      <td>${r.unidade || '—'}</td>
      <td class="td-valor">${r.taxa_ocupacao !== undefined && r.taxa_ocupacao !== '' ? r.taxa_ocupacao+'%' : '—'}</td>
      <td class="td-valor">${r.tmp !== undefined && r.tmp !== '' ? r.tmp+' dias' : '—'}</td>
      <td class="td-valor">${r.taxa_mortalidade !== undefined && r.taxa_mortalidade !== '' ? r.taxa_mortalidade+'%' : '—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editarRegistro('${r.unidade}','${r.mes}')">Editar</button>
        <button class="btn btn-sm" style="background:#FFEBEB;color:var(--danger);margin-left:4px" onclick="deletarRegistro('${r.unidade}','${r.mes}')">Remover</button>
      </td>
    </tr>`).join('');
}

function editarRegistro(unidade, mes) {
  document.getElementById('input-unidade').value = unidade;
  document.getElementById('input-mes').value = mes;
  carregarRegistroExistente();
  document.getElementById('form-topo')?.scrollIntoView({ behavior:'smooth' });
}

function deletarRegistro(unidade, mes) {
  if (!confirm(`Remover registro de ${unidade} — ${mes}?`)) return;
  const local = localStorage.getItem('hospital_indicadores');
  if (local) {
    try { EntradaApp.dados = JSON.parse(local); } catch {}
  }
  EntradaApp.dados.registros = EntradaApp.dados.registros.filter(
    r => !(r.unidade === unidade && r.mes === mes)
  );
  localStorage.setItem('hospital_indicadores', JSON.stringify(EntradaApp.dados));
  renderHistoricoEntrada();
  atualizarContador();
  showToast('Registro removido.', 'success');
}

// ── CONTADOR ─────────────────────────────────────────────────────────────────
function atualizarContador() {
  const local = localStorage.getItem('hospital_indicadores');
  const dados = local ? JSON.parse(local) : EntradaApp.dados;
  const el = document.getElementById('contador-registros');
  if (el) el.textContent = dados?.registros?.length || 0;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = (tipo === 'success' ? '✓ ' : '✕ ') + msg;
  t.className = `toast ${tipo} show`;
  setTimeout(() => t.className = 'toast', 3500);
}

// ── TABS ──────────────────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + id).style.display = 'block';
  document.querySelector(`[data-tab="${id}"]`).classList.add('active');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Registrar listeners sempre, independente da origem dos dados
  document.getElementById('input-unidade')?.addEventListener('change', carregarRegistroExistente);
  document.getElementById('input-mes')?.addEventListener('change', carregarRegistroExistente);

  // Priorizar localStorage
  const local = localStorage.getItem('hospital_indicadores');
  if (local) {
    try {
      EntradaApp.dados = JSON.parse(local);
      popularSelectUnidade();
      atualizarContador();
      renderHistoricoEntrada();
      return;
    } catch {}
  }
  await carregarDadosEntrada();
  renderHistoricoEntrada();
});
