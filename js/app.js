/*
 * app.js — interface do Painel de Permeação de Água
 * Desenvolvido por Ariele dos Santos Pirola (2026).
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const CHAVE = 'permeacao_agua_ensaio_v1';

  // ---------------- Cópia de segurança no navegador (js/backup.js; opcional) ----------------
  const armaz = window.BackupLocal || { get: () => null, set() {}, del() {} };

  // ---------------- Estado ----------------
  const est = {
    etapas: [
      { nome: '2 bar', pressao_bar: 2, duracao_min: 60, usar: true },
      { nome: '3 bar', pressao_bar: 3, duracao_min: 60, usar: true },
      { nome: '4 bar', pressao_bar: 4, duracao_min: 60, usar: true },
      { nome: '5 bar', pressao_bar: 5, duracao_min: 60, usar: true },
    ],
    balanca: null,
    coletor: new Coletor(),
    origem: 'atual',
    dadosArquivo: null,
    infoCongelada: null,
    graficos: {},
    wakeLock: null,
  };

  // ---------------- Utilidades ----------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const val = (id) => $('#' + id).value;
  const numv = (id, padrao = NaN) => { const v = parseFloat(String(val(id)).replace(',', '.')); return Number.isFinite(v) ? v : padrao; };
  function toast(msg, ms = 3200) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('visivel');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('visivel'), ms);
  }
  function confirmar(titulo, texto, rotuloSim = 'Confirmar') {
    return new Promise((res) => {
      const d = $('#dlg-confirmar');
      $('#conf-titulo').textContent = titulo; $('#conf-texto').textContent = texto; $('#conf-sim').textContent = rotuloSim;
      const fim = (r) => { d.close(); res(r); };
      $('#conf-sim').onclick = () => fim(true); $('#conf-nao').onclick = () => fim(false);
      d.showModal();
    });
  }
  function bipe() {
    try {
      const ctx = bipe.ctx || (bipe.ctx = new (window.AudioContext || window.webkitAudioContext)());
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch (_) {}
  }

  // ---------------- Navegação ----------------
  function irPara(aba) {
    $$('.passo').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    $$('.aba').forEach((s) => s.classList.toggle('ativa', s.id === 'aba-' + aba));
    if (aba === 'resultados') renderResultados();
    if (aba === 'vivo') renderVivo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.passo').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));
  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.ir)));
  $$('[data-abrir]').forEach((b) => b.addEventListener('click', () => $('#' + b.dataset.abrir).showModal()));
  $$('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const txt = $('#' + b.dataset.copiar).textContent;
    try { await navigator.clipboard.writeText(txt); toast('Citação copiada.'); }
    catch (_) { const r = document.createRange(); r.selectNodeContents($('#' + b.dataset.copiar)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selecione e copie com Ctrl+C.'); }
  }));

  // ---------------- Autoria ----------------
  $('#cit-abnt').textContent = citacaoABNT();
  $('#cit-en').textContent = citacaoEN();
  $('#nome-autora').textContent = AUTORIA.autora;
  $('#txt-rodape').textContent = `${AUTORIA.programa} v${AUTORIA.versao} © ${AUTORIA.ano} ${AUTORIA.autora}. ` +
    `Uso livre para fins acadêmicos — ao usar em trabalhos, cite: ${citacaoABNT()}`;

  // ---------------- Tabela de etapas ----------------
  function renderEtapas() {
    const tb = $('#tabela-etapas tbody');
    tb.innerHTML = '';
    est.etapas.forEach((e, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" data-c="nome" value="${esc(e.nome)}" aria-label="Nome da etapa ${i + 1}" /></td>
        <td><input type="number" step="0.1" min="0" data-c="pressao_bar" value="${e.pressao_bar}" aria-label="Pressão da etapa ${i + 1}" /></td>
        <td><input type="number" step="1" min="0.1" data-c="duracao_min" value="${e.duracao_min}" aria-label="Duração da etapa ${i + 1}" /></td>
        <td><input type="checkbox" data-c="usar" ${e.usar ? 'checked' : ''} aria-label="Usar etapa ${i + 1} na regressão" /></td>
        <td><button class="btn-remover" data-rem="${i}" aria-label="Remover etapa ${i + 1}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></td>`;
      tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
        const c = inp.dataset.c;
        e[c] = c === 'usar' ? inp.checked : c === 'nome' ? inp.value : parseFloat(inp.value);
        atualizarDuracao();
      }));
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', () => {
      est.etapas.splice(+b.dataset.rem, 1); renderEtapas();
    }));
    atualizarDuracao();
  }
  function atualizarDuracao() {
    const t = est.etapas.reduce((s, e) => s + (Number(e.duracao_min) || 0), 0);
    $('#duracao-total').textContent = `Duração total: ${t.toLocaleString('pt-BR')} min (≈ ${(t / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h), sem contar as trocas de pressão`;
  }
  $('#btn-add-etapa').addEventListener('click', () => {
    const ult = est.etapas[est.etapas.length - 1];
    const p = ult ? ult.pressao_bar + 1 : 1;
    est.etapas.push({ nome: `${p} bar`, pressao_bar: p, duracao_min: ult ? ult.duracao_min : 60, usar: true });
    renderEtapas();
  });
  renderEtapas();

  // ---------------- Balança ----------------
  const simulando = () => document.querySelector('input[name="fonte"]:checked').value === 'sim';
  function intervaloS() { return val('intervalo') === 'outro' ? Math.max(2, numv('intervalo_outro', 15)) : +val('intervalo'); }
  $('#intervalo').addEventListener('change', () => { $('#campo-intervalo-outro').hidden = val('intervalo') !== 'outro'; });

  $$('input[name="fonte"]').forEach((r) => r.addEventListener('change', async () => {
    if (est.coletor.estado === 'rodando' || est.coletor.estado === 'aguardando_pressao') {
      toast('Pare o ensaio antes de trocar a fonte.'); document.querySelector(`input[name="fonte"][value="${simulando() ? 'real' : 'sim'}"]`).checked = true; return;
    }
    await desconectar();
    $('#bloco-real').hidden = simulando();
    $('#bloco-sim').hidden = !simulando();
    if (simulando()) ligarSimulacao();
  }));

  function ligarSimulacao() {
    if (est.balanca && est.balanca instanceof Balanca.BalancaSimulada) est.balanca.desconectar();
    est.balanca = new Balanca.BalancaSimulada(numv('perm_sim', 1), numv('area', 0.0015), numv('fator', 60));
    ouvirBalanca();
  }
  ['fator', 'perm_sim'].forEach((id) => $('#' + id).addEventListener('change', () => {
    if (simulando() && est.coletor.estado !== 'rodando' && est.coletor.estado !== 'aguardando_pressao') ligarSimulacao();
  }));

  function ouvirBalanca() {
    const b = est.balanca;
    const anterior = b.aoReceber;
    b._mostrar = (u) => {
      $('#peso-ao-vivo').textContent = `${fmt(u.massa, 4)} g`;
      $('#linha-bruta').textContent = `Texto recebido: "${u.linha}". Compare com o visor da balança.`;
    };
    // o coletor substitui aoReceber durante o ensaio; o mostrador usa um "relógio" próprio
    clearInterval(est._relogioPeso);
    est._relogioPeso = setInterval(() => { if (est.balanca && est.balanca.ultima) est.balanca._mostrar(est.balanca.ultima); }, 300);
    if (!anterior) b.aoReceber = null;
  }

  async function desconectar() {
    clearInterval(est._relogioPeso);
    if (est.balanca) { await est.balanca.desconectar(); est.balanca = null; }
    $('#peso-ao-vivo').textContent = '— g';
    $('#linha-bruta').textContent = 'Compare com o visor da balança: deve ser o mesmo valor.';
    $('#selo-conexao').textContent = 'Desconectada'; $('#selo-conexao').classList.remove('ok');
    $('#btn-conectar').hidden = false; $('#btn-desconectar').hidden = true;
  }

  $('#btn-conectar').addEventListener('click', async () => {
    if (!Balanca.suportado()) { toast('Use o Google Chrome ou o Microsoft Edge para conectar a balança.', 5000); return; }
    try {
      const b = new Balanca.BalancaSerial();
      await b.conectar(+val('baud'));
      est.balanca = b;
      b.aoDesconectar = () => { toast('A balança foi desconectada (cabo solto?).', 6000); desconectar(); };
      ouvirBalanca();
      $('#selo-conexao').textContent = 'Conectada'; $('#selo-conexao').classList.add('ok');
      $('#btn-conectar').hidden = true; $('#btn-desconectar').hidden = false;
      setTimeout(() => {
        if (est.balanca === b && !b.ultima) toast('Conectado, mas nenhum peso chegou. Confira o menu da balança: PC cont e 9600.', 7000);
      }, 4000);
    } catch (e) {
      if (e && e.name === 'NotFoundError') toast('Nenhuma porta escolhida.');
      else toast('Não consegui abrir a porta: ' + (e.message || e), 6000);
    }
  });
  $('#btn-desconectar').addEventListener('click', desconectar);

  // ---------------- Coleta ----------------
  const camposInfo = ['nome_ensaio', 'amostra', 'operador', 'area', 'espessura', 'temperatura', 'densidade', 'janela', 'obs'];
  const rotulos = { nome_ensaio: 'Nome do ensaio', amostra: 'Membrana / amostra', operador: 'Operador(a)', area: 'Área (m²)',
    espessura: 'Espessura (µm)', temperatura: 'Temperatura (°C)', densidade: 'Densidade (g/mL)', janela: 'Média dos últimos (min)', obs: 'Observações' };
  const lerInfo = () => Object.fromEntries(camposInfo.map((c) => [c, val(c)]));
  function params(info = lerInfo()) {
    return {
      area: parseFloat(String(info.area).replace(',', '.')) || 0.0015,
      rho: parseFloat(String(info.densidade).replace(',', '.')) || 1,
      esp: parseFloat(String(info.espessura).replace(',', '.')) || 0,
      janela: parseFloat(String(info.janela).replace(',', '.')) || 20,
    };
  }

  $('#btn-iniciar').addEventListener('click', async () => {
    const nome = val('nome_ensaio').trim();
    if (!nome) {
      irPara('ensaio'); $('#nome_ensaio').closest('.campo').classList.add('invalido'); $('#nome_ensaio').focus();
      toast('Preencha o nome do ensaio antes de iniciar.'); return;
    }
    if (!est.balanca) {
      if (simulando()) ligarSimulacao();
      else { irPara('balanca'); toast('Conecte a balança primeiro.'); return; }
    }
    const etapas = est.etapas.filter((e) => e.pressao_bar >= 0 && e.duracao_min > 0)
      .map((e) => ({ ...e, nome: (e.nome || `${e.pressao_bar} bar`).trim() }));
    if (!etapas.length) { irPara('ensaio'); toast('Programe pelo menos uma etapa de pressão.'); return; }
    if (est.coletor.leituras.length && est.coletor.estado !== 'parado' && est.coletor.estado !== 'erro' && est.coletor.estado !== 'finalizado') return;
    if (est.coletor.leituras.length) {
      const ok = await confirmar('Começar um novo ensaio?', 'Os dados do ensaio anterior serão substituídos. Baixe-os antes na aba Resultados, se ainda não baixou.', 'Começar novo');
      if (!ok) return;
    }
    if (simulando() && est.coletor.leituras.length) ligarSimulacao();
    est.infoCongelada = { ...lerInfo(), intervalo: `${intervaloS()} s`, etapas };
    est.origem = 'atual'; document.querySelector('input[name="origem"][value="atual"]').checked = true;
    $('#bloco-arquivo').hidden = true;
    bipe.ctx || bipe(); // libera o áudio com o clique do usuário
    est.coletor.iniciar(est.balanca, etapas, intervaloS(), simulando() ? numv('fator', 60) : 1);
    pedirWakeLock();
  });
  $('#nome_ensaio').addEventListener('input', () => $('#nome_ensaio').closest('.campo').classList.remove('invalido'));
  $('#btn-continuar').addEventListener('click', () => { est.coletor.continuar(); document.title = 'Painel de Permeação de Água'; });
  $('#btn-parar').addEventListener('click', async () => {
    if (await confirmar('Parar o ensaio?', 'A coleta será interrompida. Os dados coletados até agora continuam disponíveis.', 'Parar')) est.coletor.parar();
  });

  est.coletor.aoMudar = (tipo) => {
    const c = est.coletor;
    if (tipo === 'troca') { bipe(); document.title = '(!) Troque a pressão — Painel de Permeação'; }
    if (['finalizado', 'parado', 'erro'].includes(tipo)) { soltarWakeLock(); if (tipo === 'finalizado') bipe(); }
    salvarBackup();
    renderVivo();
    if ($('#aba-resultados').classList.contains('ativa') && est.origem === 'atual') renderResultados();
  };

  // ---------------- Backup automático no navegador ----------------
  function salvarBackup() {
    const c = est.coletor;
    if (!c.leituras.length) return;
    armaz.set(CHAVE, { info: est.infoCongelada, leituras: c.leituras, estado: c.estado, salvo: new Date().toISOString(),
      inicio: c.inicio, fim: c.fim });
  }
  function verificarRecuperacao() {
    const b = armaz.get(CHAVE);
    if (!b || !b.leituras || !b.leituras.length) return;
    const quando = new Date(b.salvo).toLocaleString('pt-BR');
    $('#txt-recuperar').textContent = `Encontrei um ensaio salvo neste navegador ("${b.info?.nome_ensaio || 'sem nome'}", ${b.leituras.length} leituras, salvo em ${quando}).`;
    $('#aviso-recuperar').hidden = false;
    $('#btn-recuperar').onclick = () => {
      est.dadosArquivo = b.leituras; est.infoArquivo = b.info;
      est.origem = 'arquivo'; document.querySelector('input[name="origem"][value="arquivo"]').checked = true;
      $('#bloco-arquivo').hidden = false; $('#nome-arquivo').textContent = 'Ensaio recuperado do navegador.';
      $('#aviso-recuperar').hidden = true; irPara('resultados');
    };
    $('#btn-descartar').onclick = () => { armaz.del(CHAVE); $('#aviso-recuperar').hidden = true; };
  }

  // ---------------- Manter a tela acordada / avisar ao fechar ----------------
  async function pedirWakeLock() { try { est.wakeLock = await navigator.wakeLock?.request('screen'); } catch (_) {} }
  function soltarWakeLock() { try { est.wakeLock?.release(); } catch (_) {} est.wakeLock = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ['rodando', 'aguardando_pressao'].includes(est.coletor.estado)) pedirWakeLock();
  });
  window.addEventListener('beforeunload', (e) => {
    if (['rodando', 'aguardando_pressao'].includes(est.coletor.estado)) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------- Gráficos na tela ----------------
  Chart.defaults.font.family = "'General Sans', 'Segoe UI', sans-serif";
  Chart.defaults.color = '#4a5764';
  function graficoTela(id, cfg) {
    if (est.graficos[id]) est.graficos[id].destroy();
    cfg.options.responsive = true; cfg.options.maintainAspectRatio = false;
    if (cfg.options.plugins.legend.position !== 'bottom') cfg.options.plugins.legend.position = window.innerWidth < 760 ? 'bottom' : 'right';
    cfg.options.plugins.legend.fixa = cfg.options.plugins.legend.position === 'bottom' && window.innerWidth >= 760;
    est.graficos[id] = new Chart($('#' + id), cfg);
  }

  // ---------------- Render: ao vivo ----------------
  let relogioVivo = null;
  function renderVivo() {
    const c = est.coletor;
    const btnI = $('#btn-iniciar'), btnC = $('#btn-continuar'), btnP = $('#btn-parar');
    const ativo = c.estado === 'rodando' || c.estado === 'aguardando_pressao';
    btnI.disabled = ativo; btnC.disabled = c.estado !== 'aguardando_pressao'; btnP.disabled = !ativo;
    const st = $('#status');
    st.hidden = !c.mensagem;
    st.className = 'faixa ' + ({ aguardando_pressao: 'faixa-alerta', finalizado: 'faixa-ok', erro: 'faixa-erro', parado: 'faixa-info' }[c.estado] || 'faixa-info');
    st.textContent = c.mensagem + (c.estado === 'finalizado' ? ' Vá para a aba 4 para ver e baixar os resultados.' : '');
    const ponto = $('#ponto-vivo'); ponto.hidden = !ativo; ponto.classList.toggle('alerta', c.estado === 'aguardando_pressao');

    const p = params(est.infoCongelada || lerInfo());
    const dados = Calc.adicionarFluxos(c.leituras, p.area, p.rho);
    if (dados.length) {
      const u = c.leituras[c.leituras.length - 1];
      const ud = dados.filter((d) => d.etapa === u.etapa).pop();
      $('#k-etapa').textContent = u.etapa;
      $('#k-massa').textContent = `${fmt(u.massa_rel_g, 4)} g`;
      $('#k-fluxo').textContent = ud && u.tempo_min > 0 ? `${fmt(ud.fluxo_acumulado_LMH, 3)} L/m².h` : '—';
    } else { ['#k-etapa', '#k-massa', '#k-fluxo'].forEach((s) => ($(s).textContent = '—')); }
    if ($('#aba-vivo').classList.contains('ativa')) {
      graficoTela('g-vivo-fluxo', Exportar.configTempo(dados, 'fluxo_acumulado_LMH', 'Fluxo (L m⁻² h⁻¹)', ''));
      graficoTela('g-vivo-massa', Exportar.configTempo(dados, 'massa_rel_g', 'Massa permeada (g)', ''));
    }
    clearInterval(relogioVivo);
    relogioVivo = setInterval(() => {
      const s = c.proximaLeituraEm();
      $('#k-prox').textContent = s === null ? (c.estado === 'aguardando_pressao' ? 'aguardando' : '—') : `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
    }, 500);
  }

  // ---------------- Render: resultados ----------------
  $$('input[name="origem"]').forEach((r) => r.addEventListener('change', () => {
    est.origem = r.value; $('#bloco-arquivo').hidden = est.origem !== 'arquivo'; renderResultados();
  }));
  $('#arquivo-csv').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      est.dadosArquivo = Exportar.lerCSV(await f.text()); est.infoArquivo = null;
      $('#nome-arquivo').textContent = `${f.name} — ${est.dadosArquivo.length} leituras. Os cálculos usam os valores da aba 1 (área, espessura etc.).`;
      renderResultados();
    } catch (e) { toast('Não consegui ler o arquivo: ' + e.message, 6000); }
  });

  function conjuntoAtual() {
    if (est.origem === 'arquivo') {
      const info = est.infoArquivo || { ...lerInfo(), intervalo: '' };
      return { leituras: est.dadosArquivo || [], info, etapas: info.etapas || est.etapas };
    }
    const info = est.infoCongelada || lerInfo();
    return { leituras: est.coletor.leituras, info, etapas: info.etapas || est.etapas };
  }

  function calcular() {
    const { leituras, info, etapas } = conjuntoAtual();
    const p = params(info);
    const dados = Calc.adicionarFluxos(leituras, p.area, p.rho);
    const nomesEtapas = new Set(etapas.map((e) => e.nome));
    const usar = new Set(etapas.filter((e) => e.usar).map((e) => e.nome));
    // etapas do arquivo que não existem na tabela entram na regressão
    for (const d of dados) if (!nomesEtapas.has(d.etapa)) usar.add(d.etapa);
    const resumo = Calc.resumoPorEtapa(dados, p.area, p.esp, p.janela, usar);
    const reg = Calc.regressao(resumo);
    if (reg && p.esp > 0) reg.permeabilidade = reg.inclinacao * p.esp;
    return { dados, resumo, reg, info, p };
  }

  function renderResultados() {
    const { dados, resumo, reg } = calcular();
    const tem = dados.length > 0;
    $('#resultados').hidden = !tem; $('#resultados-vazio').hidden = tem;
    if (!tem) return;
    $('#r-lp').textContent = reg ? fmt(reg.inclinacao, 4) : '—';
    $('#r-r2').textContent = reg ? fmt(reg.r2, 4) : '—';
    const temPerm = reg && Number.isFinite(reg.permeabilidade);
    $('#r-perm').textContent = temPerm ? fmt(reg.permeabilidade, 3) : 'Informe a espessura na aba 1';
    $('#r-perm').classList.toggle('valor-vazio', !temPerm);
    $('#tabela-resumo tbody').innerHTML = resumo.map((r) => `<tr>
      <td>${esc(r.etapa)}</td><td>${fmt(r.pressao_bar, 2)}</td><td>${r.n_pontos}</td><td>${fmt(r.fluxo_medio_LMH)}</td>
      <td>${fmt(r.desvio_padrao_LMH)}</td><td>${fmt(r.cv_pct, 2)}</td><td>${fmt(r.vazao_L_h, 6)}</td>
      <td>${fmt(r.permeancia_LMH_bar)}</td><td>${fmt(r.permeabilidade, 3)}</td><td>${r.usar ? 'Sim' : 'Não'}</td></tr>`).join('');
    graficoTela('g-res-fluxo', Exportar.configTempo(dados, 'fluxo_acumulado_LMH', 'Fluxo (L m⁻² h⁻¹)', ''));
    graficoTela('g-res-pressao', Exportar.configPressao(resumo, reg, ''));
  }

  function nomeBase(info) { return (info.nome_ensaio || 'ensaio').trim().replace(/[^\w\-]+/g, '_'); }
  function infoExport(info) {
    const out = {};
    for (const c of camposInfo) out[rotulos[c]] = info[c] ?? '';
    if (info.intervalo) out['Intervalo entre leituras'] = info.intervalo;
    const c = est.coletor;
    if (est.origem === 'atual' && c.inicio) {
      out['Início do teste'] = new Date(c.inicio).toLocaleString('pt-BR');
      if (c.fim) { out['Fim do teste'] = new Date(c.fim).toLocaleString('pt-BR'); out['Duração'] = `${Math.round((new Date(c.fim) - new Date(c.inicio)) / 60000)} min`; }
    }
    out['Fórmula do fluxo'] = 'J = (m · 0,001 · 60) / (ρ · t · A)  [L/m².h]';
    out['Permeância'] = 'J / ΔP  [L/m².h.bar]';
    out['Permeabilidade'] = 'Permeância × espessura  [L.µm/m².h.bar]';
    return out;
  }

  async function comEspera(btn, fn) {
    const t = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
    try { await fn(); } catch (e) { toast('Erro ao gerar o arquivo: ' + e.message, 6000); }
    finally { btn.disabled = false; btn.textContent = t; }
  }
  $('#dl-excel').addEventListener('click', (ev) => comEspera(ev.target, async () => {
    const { dados, resumo, reg, info } = calcular();
    Exportar.baixar(await Exportar.gerarExcel(infoExport(info), dados, resumo, reg, info.amostra || info.nome_ensaio || ''), nomeBase(info) + '.xlsx');
  }));
  $('#dl-png').addEventListener('click', (ev) => comEspera(ev.target, async () => {
    const { dados, resumo, reg, info } = calcular();
    Exportar.baixar(await Exportar.zipPNG(dados, resumo, reg, info.amostra || info.nome_ensaio || ''), nomeBase(info) + '_graficos.zip');
  }));
  $('#dl-csv').addEventListener('click', () => {
    const { dados, info } = calcular();
    Exportar.baixar(Exportar.gerarCSV(dados), nomeBase(info) + '_leituras.csv');
  });

  // ---------------- Início ----------------
  if (!Balanca.suportado()) $('#aviso-navegador').hidden = false;
  verificarRecuperacao();
  renderVivo();
  window.addEventListener('resize', () => {
    const pos = window.innerWidth < 760 ? 'bottom' : 'right';
    Object.values(est.graficos).forEach((g) => { if (!g.options.plugins.legend.fixa && g.options.plugins.legend.position !== pos) { g.options.plugins.legend.position = pos; g.update('none'); } });
  });
})();
