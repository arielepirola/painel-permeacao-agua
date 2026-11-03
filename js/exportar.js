/*
 * exportar.js — CSV, Excel (com gráficos) e PNG
 * Parte do "Painel de Permeação de Água" — desenvolvido por Ariele dos Santos Pirola (2026).
 */
(function (global) {
  'use strict';

  const COLS = ['etapa', 'pressao_bar', 'leitura', 'data_hora', 'tempo_min', 'massa_balanca_g', 'massa_rel_g'];
  const CORES = ['#1d5b8f', '#d9822b', '#3a8a5c', '#b8434a', '#6b4fa0', '#8a6d3b', '#2b8a8a', '#555555'];

  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  const br = (v, d) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (v) => (Number.isFinite(v) ? String(v).replace('.', ',') : '');

  /** CSV compatível com Excel em português (;) e com a versão Python do programa. */
  function gerarCSV(dados) {
    const cab = [...COLS, 'fluxo_acumulado_LMH', 'fluxo_intervalo_LMH'];
    const linhas = dados.map(d => cab.map(c => (typeof d[c] === 'number' ? num(d[c]) : (d[c] ?? ''))).join(';'));
    return new Blob(['\ufeff' + [cab.join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  function lerCSV(texto) {
    texto = texto.replace(/^\ufeff/, '');
    const linhas = texto.split(/\r?\n/).filter(l => l.trim());
    const sep = linhas[0].includes(';') ? ';' : ',';
    const cab = linhas[0].split(sep).map(s => s.trim());
    const faltando = ['etapa', 'pressao_bar', 'tempo_min', 'massa_rel_g'].filter(c => !cab.includes(c));
    if (faltando.length) throw new Error('Arquivo sem as colunas: ' + faltando.join(', '));
    return linhas.slice(1).map(l => {
      const v = l.split(sep); const o = {};
      cab.forEach((c, i) => { o[c] = v[i]; });
      const out = { etapa: o.etapa, data_hora: o.data_hora || '' };
      for (const c of ['pressao_bar', 'leitura', 'tempo_min', 'massa_balanca_g', 'massa_rel_g'])
        out[c] = o[c] === undefined || o[c] === '' ? NaN : parseFloat(String(o[c]).replace(',', '.'));
      return out;
    });
  }

  // ---------- Gráficos para exportação (alta resolução, fundo branco) ----------
  const fundoBranco = {
    id: 'fundoBranco',
    beforeDraw(c) { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); },
  };

  function configTempo(dados, campo, rotuloY, titulo, escala = 1) {
    const grupos = new Map();
    for (const d of dados) {
      if (campo !== 'massa_rel_g' && !(d.tempo_min > 0)) continue;
      if (!grupos.has(d.etapa)) grupos.set(d.etapa, []);
      grupos.get(d.etapa).push({ x: d.tempo_min, y: d[campo] });
    }
    const datasets = [...grupos].map(([nome, pts], i) => ({
      label: nome, data: pts, borderColor: CORES[i % CORES.length], backgroundColor: CORES[i % CORES.length],
      showLine: true, pointRadius: pts.length > 80 ? 0 : 3 * escala, borderWidth: 2 * escala, tension: 0,
    }));
    return eixos({ type: 'scatter', data: { datasets } }, 'Tempo (min)', rotuloY, titulo, escala);
  }

  function configPressao(resumo, reg, titulo, escala = 1) {
    const pts = resumo.map(r => ({ x: r.pressao_bar, y: r.fluxo_medio_LMH, dp: r.desvio_padrao_LMH }));
    const datasets = [{
      label: 'Fluxo médio', data: pts, borderColor: '#1d5b8f', backgroundColor: '#1d5b8f',
      pointRadius: 6 * escala, showLine: false,
    }];
    if (reg) {
      const xm = Math.max(...resumo.map(r => r.pressao_bar)) * 1.05;
      datasets.push({
        label: `J = ${br(reg.inclinacao, 3)}·ΔP ${reg.intercepto >= 0 ? '+' : '−'} ${br(Math.abs(reg.intercepto), 3)}   (R² = ${br(reg.r2, 4)})`,
        data: [{ x: 0, y: reg.intercepto }, { x: xm, y: reg.inclinacao * xm + reg.intercepto }],
        borderColor: '#b8434a', backgroundColor: '#b8434a', showLine: true, pointRadius: 0, borderWidth: 2 * escala,
      });
    }
    const cfg = eixos({ type: 'scatter', data: { datasets } }, 'Pressão (bar)', 'Fluxo (L m⁻² h⁻¹)', titulo, escala);
    cfg.options.scales.x.min = 0; cfg.options.scales.y.min = 0; cfg.options.scales.y.grace = '8%';
    cfg.options.plugins.legend.position = 'bottom';
    cfg.plugins = [barrasErro];
    return cfg;
  }

  // barras de erro (± desvio padrão) desenhadas à mão
  const barrasErro = {
    id: 'barrasErro',
    afterDatasetsDraw(c) {
      const ds = c.data.datasets[0]; if (!ds) return;
      const meta = c.getDatasetMeta(0), y = c.scales.y, ctx = c.ctx;
      ctx.save(); ctx.strokeStyle = ds.borderColor; ctx.lineWidth = 1.5;
      meta.data.forEach((p, i) => {
        const d = ds.data[i]; if (!Number.isFinite(d.dp)) return;
        const y1 = y.getPixelForValue(d.y - d.dp), y2 = y.getPixelForValue(d.y + d.dp), w = 6;
        ctx.beginPath(); ctx.moveTo(p.x, y1); ctx.lineTo(p.x, y2);
        ctx.moveTo(p.x - w, y1); ctx.lineTo(p.x + w, y1); ctx.moveTo(p.x - w, y2); ctx.lineTo(p.x + w, y2);
        ctx.stroke();
      });
      ctx.restore();
    },
  };

  function eixos(cfg, rx, ry, titulo, escala) {
    const fonte = { family: "'General Sans', 'Segoe UI', sans-serif", size: 13 * escala };
    cfg.options = {
      animation: false, responsive: false, maintainAspectRatio: false, locale: 'pt-BR',
      layout: { padding: 16 * escala },
      plugins: {
        legend: { position: 'right', labels: { font: fonte, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 * escala, boxHeight: 8 * escala, padding: 12 * escala } },
        title: { display: !!titulo, text: titulo, font: { ...fonte, size: 13 * escala, weight: '500' }, color: '#333' },
        tooltip: { enabled: true },
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: rx, font: fonte, color: '#222' }, ticks: { font: fonte, color: '#333' }, grid: { color: '#eee' } },
        y: { title: { display: true, text: ry, font: fonte, color: '#222' }, ticks: { font: fonte, color: '#333' }, grid: { color: '#eee' } },
      },
    };
    return cfg;
  }

  function graficoPNG(cfg, largura = 2100, altura = 1300) {
    const canvas = document.createElement('canvas');
    canvas.width = largura; canvas.height = altura;
    canvas.style.width = largura + 'px'; canvas.style.height = altura + 'px';
    cfg.options.devicePixelRatio = 1;
    cfg.plugins = [...(cfg.plugins || []), fundoBranco];
    const ch = new Chart(canvas.getContext('2d'), cfg);
    const url = canvas.toDataURL('image/png');
    ch.destroy();
    return url;
  }

  function todosPNG(dados, resumo, reg, titulo) {
    const e = 2.6;
    const out = {
      'fluxo_x_tempo.png': graficoPNG(configTempo(dados, 'fluxo_acumulado_LMH', 'Fluxo (L m⁻² h⁻¹)', titulo, e)),
      'massa_x_tempo.png': graficoPNG(configTempo(dados, 'massa_rel_g', 'Massa permeada (g)', titulo, e)),
    };
    if (resumo.length) out['fluxo_x_pressao.png'] = graficoPNG(configPressao(resumo, reg, titulo, e));
    return out;
  }

  async function zipPNG(dados, resumo, reg, titulo) {
    const zip = new JSZip();
    for (const [nome, url] of Object.entries(todosPNG(dados, resumo, reg, titulo)))
      zip.file(nome, url.split(',')[1], { base64: true });
    return zip.generateAsync({ type: 'blob' });
  }

  // ---------- Excel ----------
  async function gerarExcel(info, dados, resumo, reg, titulo) {
    const wb = new ExcelJS.Workbook();
    wb.creator = AUTORIA.autora;
    const negrito = { bold: true };

    const s1 = wb.addWorksheet('Informações');
    s1.columns = [{ width: 34 }, { width: 90 }];
    s1.addRow(['Campo', 'Valor']).font = negrito;
    for (const [k, v] of Object.entries(info)) s1.addRow([k, v]);
    s1.addRow([]);
    s1.addRow(['Software', `${AUTORIA.programa} v${AUTORIA.versao} — desenvolvido por ${AUTORIA.autora}`]);
    s1.addRow(['Como citar', citacaoABNT()]);
    s1.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

    const s2 = wb.addWorksheet('Leituras');
    const cab = ['Etapa', 'Pressão (bar)', 'Leitura', 'Data/hora', 'Tempo (min)', 'Massa na balança (g)',
      'Massa permeada (g)', 'Fluxo acumulado (L/m².h)', 'Fluxo no intervalo (L/m².h)'];
    s2.addRow(cab).font = negrito;
    s2.columns = cab.map(() => ({ width: 20 }));
    const fin = v => (Number.isFinite(v) ? v : null);
    for (const d of dados) s2.addRow([d.etapa, d.pressao_bar, fin(d.leitura), d.data_hora, d.tempo_min,
      fin(d.massa_balanca_g), d.massa_rel_g, fin(d.fluxo_acumulado_LMH), fin(d.fluxo_intervalo_LMH)]);
    s2.views = [{ state: 'frozen', ySplit: 1 }];

    const s3 = wb.addWorksheet('Resumo');
    const cabR = ['Etapa', 'Pressão (bar)', 'Nº pontos na média', 'Fluxo médio (L/m².h)', 'Desvio padrão (L/m².h)',
      'CV (%)', 'Vazão (L/h)', 'Permeância (L/m².h.bar)', 'Permeabilidade (L.µm/m².h.bar)', 'Usada na regressão'];
    s3.addRow(cabR).font = negrito;
    s3.columns = cabR.map(() => ({ width: 22 }));
    for (const r of resumo) s3.addRow([r.etapa, r.pressao_bar, r.n_pontos, fin(r.fluxo_medio_LMH), fin(r.desvio_padrao_LMH),
      fin(r.cv_pct), fin(r.vazao_L_h), fin(r.permeancia_LMH_bar), fin(r.permeabilidade), r.usar ? 'Sim' : 'Não']);
    s3.addRow([]);
    if (reg) {
      s3.addRow(['Regressão J = Lp·ΔP + b']).font = negrito;
      s3.addRow(['Inclinação Lp (L/m².h.bar)', reg.inclinacao]);
      s3.addRow(['Intercepto b (L/m².h)', reg.intercepto]);
      s3.addRow(['R²', reg.r2]);
      if (Number.isFinite(reg.permeabilidade)) s3.addRow(['Permeabilidade (L.µm/m².h.bar)', reg.permeabilidade]);
    }

    const s4 = wb.addWorksheet('Gráficos');
    const imgs = todosPNG(dados, resumo, reg, titulo);
    let linha = 0;
    for (const url of Object.values(imgs)) {
      const id = wb.addImage({ base64: url, extension: 'png' });
      s4.addImage(id, { tl: { col: 0, row: linha }, ext: { width: 840, height: 520 } });
      linha += 28;
    }

    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  global.Exportar = { baixar, gerarCSV, lerCSV, gerarExcel, zipPNG, configTempo, configPressao, CORES };
})(window);
