/*
 * autoria.js — autoria e citação. Edite aqui (instituição, DOI, link).
 */
window.AUTORIA = {
  programa: 'Painel de Permeação de Água',
  versao: '1.0',
  ano: '2026',
  autora: 'Ariele dos Santos Pirola',
  instituicao: '',   // ex.: 'Programa de Pós-Graduação em Engenharia Química – Universidade X'
  contato: 'arielepirola@gmail.com',
  link: '',          // ex.: 'https://doi.org/10.5281/zenodo.xxxxxxx'
};

window.citacaoABNT = function () {
  const a = window.AUTORIA;
  const inst = a.instituicao ? ` ${a.instituicao},` : '';
  const link = a.link ? ` Disponível em: ${a.link}.` : '';
  return `PIROLA, A. S. ${a.programa}: software para aquisição automática de massa e cálculo de fluxo, ` +
    `permeância e permeabilidade em ensaios de permeação de água. Versão ${a.versao}.${inst} ${a.ano}.${link}`;
};

window.citacaoEN = function () {
  const a = window.AUTORIA;
  const link = a.link ? ` ${a.link}` : '';
  return `Pirola, A. S. (${a.ano}). ${a.programa} (Water Permeation Dashboard): software for automated mass ` +
    `acquisition and calculation of water flux, permeance and permeability (Version ${a.versao}) [Computer software].${link}`;
};
