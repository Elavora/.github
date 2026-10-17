'use strict';

// Sincronização de labels com prune total. Especificação: docs/labels.md

const KEYS = ['color', 'description', 'name'];
const COLOR_PATTERN = /^[0-9a-f]{6}$/;
const MAX_DESCRIPTION = 100;

function validateCatalog(catalog) {
  if (!Array.isArray(catalog)) throw new Error('catálogo inválido: precisa ser um array JSON de labels');
  if (catalog.length === 0) throw new Error('catálogo inválido: o array está vazio');

  const seen = new Set();
  catalog.forEach((item, index) => {
    const where = `catálogo inválido: item ${index}`;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${where} precisa ser um objeto { name, color, description }`);
    }
    const keys = Object.keys(item).sort();
    if (keys.length !== KEYS.length || keys.some((key, i) => key !== KEYS[i])) {
      throw new Error(`${where} precisa ter exatamente as chaves name, color e description`);
    }
    const { name, color, description } = item;
    if (typeof name !== 'string' || typeof color !== 'string' || typeof description !== 'string') {
      throw new Error(`${where}: name, color e description precisam ser strings`);
    }
    if (name === '' || name.trim() !== name) {
      throw new Error(`${where}: name não pode ser vazio nem ter espaços nas pontas`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`${where}: name "${name}" repetido (sem diferenciar caixa)`);
    seen.add(key);
    if (!COLOR_PATTERN.test(color)) {
      throw new Error(`${where} ("${name}"): color precisa ter 6 dígitos hexadecimais minúsculos, sem #`);
    }
    if ([...description].length > MAX_DESCRIPTION) {
      throw new Error(`${where} ("${name}"): description passa de ${MAX_DESCRIPTION} caracteres`);
    }
  });
}

function planLabelSync(catalog, existing) {
  validateCatalog(catalog);
  const current = new Map((existing ?? []).map((label) => [label.name.toLowerCase(), label]));
  const wanted = new Set(catalog.map((label) => label.name.toLowerCase()));

  const plan = { create: [], update: [], remove: [], unchanged: [] };
  for (const { name, color, description } of catalog) {
    const label = current.get(name.toLowerCase());
    if (!label) {
      plan.create.push({ name, color, description });
    } else if (
      label.name !== name
      || String(label.color).toLowerCase() !== color
      || (label.description ?? '') !== description
    ) {
      plan.update.push({ current: label.name, name, color, description });
    } else {
      plan.unchanged.push(label.name);
    }
  }
  for (const label of existing ?? []) {
    if (!wanted.has(label.name.toLowerCase())) plan.remove.push(label.name);
  }
  return plan;
}

module.exports = { validateCatalog, planLabelSync };
