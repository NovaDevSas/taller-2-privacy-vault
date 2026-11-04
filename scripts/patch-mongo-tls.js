import {readFile, writeFile} from 'node:fs/promises';

const driverPath = new URL('../node_modules/mongodb/lib/cmap/connect.js', import.meta.url);
const source = await readFile(driverPath, 'utf8');
const tlsImport = /(\b(?:const|let|var)\s+[\w$]+\s*=\s*)(?:__importStar\(\s*)?require\((["'])(?:node:)?tls\2\)\s*\)?/m;
const adapterPath = '../../../../lib/cloudflare-mongo-tls.js';

if (source.includes(adapterPath)) process.exit(0);
if (!tlsImport.test(source)) {
  throw new Error('No se encontró una importación compatible de tls en el driver de MongoDB.');
}

await writeFile(driverPath, source.replace(tlsImport, (_match, binding) =>
  `${binding}require("${adapterPath}")`
));
