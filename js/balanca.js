/*
 * balanca.js — comunicação com a balança BEL Mark S pelo navegador (Web Serial API)
 * Parte do "Painel de Permeação de Água" — desenvolvido por Ariele dos Santos Pirola (2026).
 *
 * No modo "PC cont" a balança envia o peso sem parar, em linhas como:
 *   "   12.3456 g  *\r\n"   (sinal, peso, unidade, indicador de estabilidade, CR, LF)
 * Formato fixo: 8 bits, sem paridade, 1 stop bit; 1200–9600 baud (padrão 9600).
 * Funciona no Google Chrome e no Microsoft Edge (computador). Não funciona no Firefox/Safari.
 */
(function (global) {
  'use strict';

  const NUMERO = /[-+]?\s*\d+(?:[.,]\d+)?/;

  function extrairMassa(linha) {
    if (!linha) return null;
    const m = linha.match(NUMERO);
    if (!m) return null;
    let v = parseFloat(m[0].replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(v)) return null;
    const t = linha.toLowerCase();
    if (/\bmg\b/.test(t)) v /= 1000;
    else if (/\bkg\b/.test(t)) v *= 1000;
    return v;
  }

  const suportado = () => 'serial' in navigator;

  class BalancaSerial {
    constructor() {
      this.port = null; this.reader = null; this.ativa = false;
      this.ultima = null;          // { massa, linha, t }
      this.aoReceber = null;       // callback a cada linha válida
      this.aoDesconectar = null;
    }
    async conectar(baud = 9600) {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: Number(baud), dataBits: 8, parity: 'none', stopBits: 1 });
      this.ativa = true;
      this._loop();
      navigator.serial.addEventListener('disconnect', (e) => {
        if (e.target === this.port) { this.ativa = false; this.aoDesconectar && this.aoDesconectar(); }
      });
    }
    async _loop() {
      const dec = new TextDecoder('ascii');
      let buffer = '', primeira = true;
      while (this.port && this.port.readable && this.ativa) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            let i;
            while ((i = buffer.search(/[\r\n]/)) >= 0) {
              const linha = buffer.slice(0, i).trim();
              buffer = buffer.slice(i + 1);
              if (primeira) { primeira = false; continue; } // 1ª linha pode vir cortada
              const massa = extrairMassa(linha);
              if (linha && massa !== null) {
                this.ultima = { massa, linha, t: Date.now() };
                this.aoReceber && this.aoReceber(this.ultima);
              }
            }
            if (buffer.length > 500) buffer = '';
          }
        } catch (e) {
          // erro de leitura (ex.: ruído) — tenta continuar
        } finally {
          try { this.reader.releaseLock(); } catch (_) {}
        }
      }
    }
    /** Devolve o peso mais recente (no máximo `maxIdadeMs` de idade). */
    ler(maxIdadeMs = 4000) {
      if (!this.ultima || Date.now() - this.ultima.t > maxIdadeMs) return null;
      return this.ultima.massa;
    }
    async desconectar() {
      this.ativa = false;
      try { await this.reader?.cancel(); } catch (_) {}
      try { await this.port?.close(); } catch (_) {}
      this.port = null;
    }
  }

  /** Balança de mentira, para treinar sem equipamento. */
  class BalancaSimulada {
    constructor(permeancia = 1.0, area = 0.0015, fator = 60) {
      this.permeancia = permeancia; this.area = area; this.fator = fator;
      this.massa = 50; this.pressao = 0; this.tUlt = performance.now();
      this.ultima = null; this.aoReceber = null; this.ativa = true;
      this._timer = setInterval(() => this._emitir(), 250);
    }
    definirPressao(p) { this._avancar(); this.pressao = p; }
    _avancar() {
      const agora = performance.now();
      const dtH = (agora - this.tUlt) / 3.6e6 * this.fator;
      this.tUlt = agora;
      const j = this.permeancia * this.pressao * (0.95 + Math.random() * 0.1);
      this.massa += j * this.area * dtH * 1000;
    }
    _emitir() {
      this._avancar();
      const v = this.massa + (Math.random() - 0.5) * 0.004;
      const linha = ` ${v.toFixed(4).padStart(9)} g  *`;
      this.ultima = { massa: extrairMassa(linha), linha, t: Date.now() };
      this.aoReceber && this.aoReceber(this.ultima);
    }
    ler() { this._avancar(); return this.massa + (Math.random() - 0.5) * 0.004; } // leitura sempre atual
    async desconectar() { clearInterval(this._timer); this.ativa = false; }
  }

  global.Balanca = { extrairMassa, suportado, BalancaSerial, BalancaSimulada };
})(window);
