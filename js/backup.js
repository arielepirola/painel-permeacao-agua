/*
 * backup.js — cópia de segurança automática do ensaio no próprio navegador.
 * Se o notebook travar, ao abrir o site de novo aparece "Abrir nos resultados".
 * Parte do "Painel de Permeação de Água" — desenvolvido por Ariele dos Santos Pirola (2026).
 */
window.BackupLocal = {
  get(k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (_) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { window.localStorage.removeItem(k); } catch (_) {} },
};
