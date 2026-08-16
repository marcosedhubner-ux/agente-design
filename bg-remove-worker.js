const fs = require('fs');

const [, , srcPath, destPath] = process.argv;

(async () => {
  try {
    const { removeBackground } = require('@imgly/background-removal-node');
    const buf = fs.readFileSync(srcPath);
    const blobIn = new Blob([buf], { type: 'image/png' });
    const blob = await removeBackground(blobIn, { model: 'small', debug: false });
    const outBuf = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(destPath, outBuf);
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
})();
