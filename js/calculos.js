/*
 * calculos.js — fórmulas do ensaio de permeação de água
 * Parte do "Painel de Permeação de Água" — desenvolvido por Ariele dos Santos Pirola (2026).
 *
 * Fluxo (igual à planilha do laboratório):
 *   J (L/m².h) = (m_g · 0,001 · 60) / (ρ · t_min · A_m²)
 */
(function (global) {
  'use strict';

  function fluxo(massa_g, t_min, area, rho) {
    if (!(t_min > 0)) return NaN;
    return (massa_g / rho / 1000) / ((t_min / 60) * area);
  }

  function media(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
  function desvio(a) {
    if (a.length < 2) return NaN;
    const m = media(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  }

  /** Agrupa as leituras por etapa, preservando a ordem. */
  function porEtapa(leituras) {
    const mapa = new Map();
    for (const l of leituras) {
      if (!mapa.has(l.etapa)) mapa.set(l.etapa, []);
      mapa.get(l.etapa).push(l);
    }
    return mapa;
  }

  /** Acrescenta fluxo acumulado e fluxo no intervalo a cada leitura. */
  function adicionarFluxos(leituras, area, rho) {
    const saida = [];
    for (const [, lista] of porEtapa(leituras)) {
      const ord = [...lista].sort((a, b) => a.tempo_min - b.tempo_min);
      ord.forEach((l, i) => {
        const ant = ord[i - 1];
        const ji = ant ? fluxo(l.massa_rel_g - ant.massa_rel_g, l.tempo_min - ant.tempo_min, area, rho) : NaN;
        saida.push({ ...l, fluxo_acumulado_LMH: fluxo(l.massa_rel_g, l.tempo_min, area, rho), fluxo_intervalo_LMH: ji });
      });
    }
    return saida;
  }

  /** Resumo por pressão: média dos pontos dos últimos `janela` minutos (estado estacionário). */
  function resumoPorEtapa(dados, area, espessura_um, janela, usarEtapas) {
    const linhas = [];
    for (const [etapa, lista] of porEtapa(dados)) {
      const pts = lista.filter(l => l.tempo_min > 0);
      if (!pts.length) continue;
      const tFim = Math.max(...pts.map(l => l.tempo_min));
      const tol = 0.02 * janela;
      const ult = pts.filter(l => l.tempo_min >= tFim - janela - tol).map(l => l.fluxo_acumulado_LMH).filter(Number.isFinite);
      const p = Number(lista[0].pressao_bar);
      const jm = ult.length ? media(ult) : NaN;
      const dp = desvio(ult);
      const perm = p > 0 ? jm / p : NaN;
      linhas.push({
        etapa, pressao_bar: p, n_pontos: ult.length,
        fluxo_medio_LMH: jm, desvio_padrao_LMH: dp, cv_pct: jm ? 100 * dp / jm : NaN,
        vazao_L_h: jm * area, permeancia_LMH_bar: perm,
        permeabilidade: espessura_um > 0 ? perm * espessura_um : NaN,
        usar: usarEtapas ? usarEtapas.has(etapa) : true,
      });
    }
    return linhas;
  }

  /** Regressão linear J = Lp·ΔP + b. */
  function regressao(resumo) {
    const r = resumo.filter(x => x.usar && Number.isFinite(x.fluxo_medio_LMH));
    if (r.length < 2) return null;
    const x = r.map(v => v.pressao_bar), y = r.map(v => v.fluxo_medio_LMH);
    const mx = media(x), my = media(y);
    const sxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
    if (sxx === 0) return null;
    const a = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / sxx;
    const b = my - a * mx;
    const ssr = y.reduce((s, yi, i) => s + (yi - (a * x[i] + b)) ** 2, 0);
    const sst = y.reduce((s, yi) => s + (yi - my) ** 2, 0);
    return { inclinacao: a, intercepto: b, r2: sst > 0 ? 1 - ssr / sst : NaN, n: r.length };
  }

  global.Calc = { fluxo, adicionarFluxos, resumoPorEtapa, regressao };
})(window);
