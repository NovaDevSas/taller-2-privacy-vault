import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anonymize, restore} from '../lib/vault.js';

/** Generador de tokens predecible para las pruebas. */
const counter = () => { let n = 0; return type => `${type}_${++n}`; };

test('protege y restaura datos de prueba, incluso repetidos', () => {
  const input = 'Dago Borda escribe a dago@example.com o al 3152319157. dago@example.com';
  const result = anonymize(input, counter());
  for (const value of ['Dago Borda', 'dago@example.com', '3152319157']) assert.ok(!result.text.includes(value));
  assert.equal(result.mappings.length, 3);
  assert.equal(restore(result.text, result.mappings), input);
});

test('reproduce el ejemplo del enunciado con un token por dato', () => {
  const input = 'oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';
  const result = anonymize(input, counter());
  assert.equal(result.text, 'oferta de trabajo para NAME_3 con email EMAIL_1 y teléfono PHONE_2');
  assert.equal(restore(result.text, result.mappings), input);
});

test('no incluye saludos ni la palabra "Firma" dentro del nombre', () => {
  const result = anonymize('Hola Dago Borda, te escribo. Firma Laura Martínez.', counter());
  assert.deepEqual(result.mappings.map(m => m.value), ['Dago Borda', 'Laura Martínez']);
  assert.equal(result.text, 'Hola NAME_1, te escribo. Firma NAME_2.');
});

test('detecta nombres con partículas y teléfonos con indicativo', () => {
  const result = anonymize('Contactar a María José Pérez de la Torre al +57 315 231 9157', counter());
  assert.deepEqual(result.mappings.map(m => m.value), ['+57 315 231 9157', 'María José Pérez de la Torre']);
});

test('no confunde organizaciones con personas', () => {
  assert.deepEqual(anonymize('Clase en la Universidad de los Andes').mappings, []);
});

test('deja texto sin coincidencias sin cambios', () => {
  assert.deepEqual(anonymize('hola mundo'), {text: 'hola mundo', mappings: []});
});
