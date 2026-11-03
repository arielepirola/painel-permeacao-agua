/*
 * coletor.js — faz as leituras no tempo programado e controla as etapas de pressão
 * Parte do "Painel de Permeação de Água" — desenvolvido por Ariele dos Santos Pirola (2026).
 *
 * No início de cada etapa grava a massa inicial (m0): não é preciso tarar
 * nem esvaziar o béquer entre as pressões.
 */
(function (global) {
  'use strict';

  class Coletor {
    constructor() { this.reset(); this.aoMudar = null; }

    reset() {
      this.estado = 'parado';   // parado | rodando | aguardando_pressao | finalizado | erro
      this.leituras = [];
      this.etapas = [];
      this.i = -1;
      this.mensagem = '';
      this.inicio = null; this.fim = null;
      clearInterval(this._timer);
    }

    iniciar(balanca, etapas, intervalo_s, fator = 1) {
      this.reset();
      this.balanca = balanca; this.etapas = etapas;
      this.intervalo_s = intervalo_s; this.fator = fator;
      this.inicio = new Date();
      this.estado = 'rodando';
      this._timer = setInterval(() => this.verificar(), fator > 1 ? 20 : 200);
      balanca.aoReceber = () => this.verificar(); // dados da balança também "acordam" o coletor
      this._comecarEtapa(0);
    }

    agora() { return Date.now(); }

    _comecarEtapa(i) {
      this.i = i;
      const e = this.etapas[i];
      if (this.balanca.definirPressao) this.balanca.definirPressao(e.pressao_bar);
      this.estado = 'rodando';
      this.mensagem = `Etapa ${i + 1} de ${this.etapas.length} — ${e.nome}`;
      this._m0 = null; this._t0 = null; this._prox = 1; this._semDados = this.agora();
      this._n = Math.max(1, Math.round(e.duracao_min * 60 / this.intervalo_s));
      this._notificar();
    }

    verificar() {
      if (this.estado !== 'rodando') return;
      const e = this.etapas[this.i];
      const m = this.balanca.ler();
      if (m === null) {
        if (this.agora() - this._semDados > 30000) {
          this._erro('A balança parou de enviar dados há mais de 30 s. Confira o cabo e se ela está ligada.');
        }
        return;
      }
      this._semDados = this.agora();

      if (this._m0 === null) {                      // primeira leitura da etapa (t = 0)
        this._m0 = m; this._t0 = this.agora();
        this._registrar(e, 0, 0, m);
        return;
      }
      const decorrido_s = (this.agora() - this._t0) / 1000 * this.fator;
      const k = Math.floor(decorrido_s / this.intervalo_s + 1e-9);
      if (k >= this._prox) {
        this._registrar(e, Math.min(k, this._n), decorrido_s / 60, m);
        this._prox = k + 1;
        if (this._prox > this._n) this._fimEtapa();
      }
    }

    proximaLeituraEm() {
      if (this.estado !== 'rodando' || this._t0 === null) return null;
      const alvo = this._prox * this.intervalo_s;
      const decorrido = (this.agora() - this._t0) / 1000 * this.fator;
      return Math.max(0, alvo - decorrido);
    }

    _fimEtapa() {
      if (this.i + 1 < this.etapas.length) {
        this.estado = 'aguardando_pressao';
        this.mensagem = `Ajuste a pressão para ${this.etapas[this.i + 1].pressao_bar} bar e clique em Continuar.`;
        this._notificar('troca');
      } else {
        this._encerrar('finalizado', 'Ensaio concluído.');
      }
    }

    continuar() { if (this.estado === 'aguardando_pressao') this._comecarEtapa(this.i + 1); }

    parar() {
      if (this.estado === 'rodando' || this.estado === 'aguardando_pressao')
        this._encerrar('parado', 'Ensaio interrompido. Os dados coletados até aqui estão na aba Resultados.');
    }

    _erro(msg) { this._encerrar('erro', msg); }

    _encerrar(estado, msg) {
      clearInterval(this._timer);
      this.estado = estado; this.mensagem = msg; this.fim = new Date();
      if (this.balanca) this.balanca.aoReceber = null;
      this._notificar(estado);
    }

    _registrar(e, k, t_min, m) {
      const agora = new Date();
      this.leituras.push({
        etapa: e.nome, pressao_bar: e.pressao_bar, leitura: k,
        data_hora: agora.toLocaleString('pt-BR'),
        tempo_min: +t_min.toFixed(4), massa_balanca_g: +m.toFixed(4), massa_rel_g: +(m - this._m0).toFixed(4),
      });
      this._notificar('leitura');
    }

    _notificar(tipo) { this.aoMudar && this.aoMudar(tipo); }
  }

  global.Coletor = Coletor;
})(window);
