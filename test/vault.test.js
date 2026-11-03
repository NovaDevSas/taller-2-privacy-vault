import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anonymize,restore} from '../lib/vault.js';
test('protege y restaura datos de prueba, incluso repetidos',()=>{
 let n=0; const input='Dago Borda escribe a dago@example.com o al 3152319157. dago@example.com';
 const result=anonymize(input, type=>`${type}_${++n}`);
 for(const value of ['Dago Borda','dago@example.com','3152319157']) assert.ok(!result.text.includes(value));
 assert.equal(result.mappings.length,3); assert.equal(restore(result.text,result.mappings),input);
});
test('deja texto sin coincidencias sin cambios',()=>{assert.deepEqual(anonymize('hola mundo'),{text:'hola mundo',mappings:[]});});
