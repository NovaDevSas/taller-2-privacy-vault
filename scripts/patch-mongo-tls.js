import {readFile, writeFile} from 'node:fs/promises';

const driverPath = new URL('../node_modules/mongodb/lib/cmap/connect.js', import.meta.url);
const source = await readFile(driverPath, 'utf8');
const tlsImport = /const tls = require(["']tls["']);/;
const replacement = 'const tls = require("../../../../lib/cloudflare-mongo-tls.js");';

if (source.includes(replacement)) process.exit(0);
if (!tlsImport.test(source)) {
  throw new Error('No se encontró el import TLS esperado en el driver de MongoDB.');
}

await writeFile(driverPath, source.replace(tlsImport, replacement));
