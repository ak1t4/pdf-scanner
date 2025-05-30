const express = require('express');
const multer = require('multer');
const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

let currentProcesses = [];

app.post('/scan', upload.single('pdfList'), async (req, res) => {
  if (!req.file || !req.body.keywords) {
    return res.status(400).json({ error: 'Faltan archivo o palabras clave' });
  }

  const filePath = req.file.path;
  const keywords = req.body.keywords;

  const results = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  // Función para limpiar URLs
  const cleanUrl = (url) => url.trim().replace(/^['"]|['"]$/g, '');

  for await (const line of rl) {
    const url = cleanUrl(line);
    if (!url) continue;

    const tmpFile = path.join(__dirname, 'uploads', `tmp_${Date.now()}.pdf`);

    // Ejecutar wget para descargar PDF
    try {
      // Guardar proceso para posible cancelación
      const wgetProcess = exec(`wget -q -O "${tmpFile}" "${url}"`);
      currentProcesses.push(wgetProcess);

      await new Promise((resolve, reject) => {
        wgetProcess.on('close', (code) => {
          if (code !== 0) {
            results.push({ url, match: false });
            return resolve();
          }

          // Buscar keywords con pdftotext y grep
          exec(`pdftotext -q "${tmpFile}" - | grep -Eaiq "${keywords}"`, (err, stdout, stderr) => {
            if (!err) {
              results.push({ url, match: true });
            } else {
              results.push({ url, match: false });
            }
            // Borrar archivo temporal
            fs.unlink(tmpFile, () => {});
            resolve();
          });
        });
      });
    } catch (e) {
      results.push({ url, match: false });
    }
  }

  // Limpiar array de procesos activos
  currentProcesses = [];

  // Borrar archivo de entrada
  fs.unlink(filePath, () => {});

//  res.json(results);
  res.json(results.filter(r => r.match));

});

app.post('/cancel', (req, res) => {
  currentProcesses.forEach(proc => {
    proc.kill('SIGTERM');
  });
  currentProcesses = [];
  res.json({ cancelled: true });
});

app.listen(3000, () => {
  console.log('Servidor iniciado en http://localhost:3000');
});
