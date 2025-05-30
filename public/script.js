const form = document.getElementById('scan-form');
const resultList = document.getElementById('result-list');
const cancelBtn = document.getElementById('cancel-btn');
const clearBtn = document.getElementById('clear-btn');
const startBtn = document.getElementById('start-btn');

let abortController = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (abortController) {
    alert('Ya hay un análisis en curso.');
    return;
  }

  const fileInput = document.getElementById('pdfList');
  const keywords = document.getElementById('keywords').value;
  const file = fileInput.files[0];
  if (!file) return;

  abortController = new AbortController();

  startBtn.disabled = true;
  cancelBtn.disabled = false;

  const formData = new FormData();
  formData.append('pdfList', file);
  formData.append('keywords', keywords);

  try {
    const res = await fetch('/scan', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    if (!res.ok) {
      throw new Error('Error en el análisis');
    }

    const results = await res.json();
    resultList.innerHTML = '';

    if (results.length === 0) {
      // No hay matches
      const noMatchDiv = document.createElement('div');
      noMatchDiv.innerHTML = `<span class="text-gray-500 italic">No matches found.</span>`;
      resultList.appendChild(noMatchDiv);
    } else {
      results.forEach(r => {
        const cleanUrl = r.url.replace(/^['"]|['"]$/g, '');
        const div = document.createElement('div');
        div.innerHTML = r.match ?
          `<span class="text-red-600 font-bold">[MATCH]</span> <a href="${cleanUrl}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>` :
          `<span class="text-gray-500">[NO MATCH]</span> ${cleanUrl}`;
        resultList.appendChild(div);
      });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      alert('Análisis cancelado');
    } else {
      alert('Error: ' + err.message);
    }
  } finally {
    abortController = null;
    startBtn.disabled = false;
    cancelBtn.disabled = true;
  }
});

cancelBtn.addEventListener('click', async () => {
  if (!abortController) {
    alert('No hay análisis en curso.');
    return;
  }
  abortController.abort();

  // Llama endpoint backend para matar procesos wget
  try {
    await fetch('/cancel', { method: 'POST' });
  } catch {}

  abortController = null;
  startBtn.disabled = false;
  cancelBtn.disabled = true;
});

clearBtn.addEventListener('click', () => {
  resultList.innerHTML = '';
});
