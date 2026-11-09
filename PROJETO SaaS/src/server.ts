import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const studentsList = [
  { id: '1', name: 'Carlos Silva', email: 'carlos@email.com', goal: 'Hipertrofia', status: 'Ativo' }
];

app.get('/api/students', (req, res) => res.json(studentsList));

app.post('/api/students', (req, res) => {
  const { name, email, goal } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
  const newStudent = { id: Date.now().toString(), name, email: email || '', goal: goal || 'Geral', status: 'Ativo' };
  studentsList.push(newStudent);
  res.status(201).json(newStudent);
});

app.get('/dashboard/students', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Impetus - Gestão de Alunos</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, sans-serif; margin: 0; display: flex; }
    .sidebar { width: 260px; background: #121214; border-right: 1px solid #27272a; height: 100vh; padding: 1.5rem; position: fixed; box-sizing: border-box; }
    .brand { font-size: 1.25rem; font-weight: bold; color: #fff; text-decoration: none; margin-bottom: 2rem; display: block; }
    .main { margin-left: 260px; padding: 2rem; width: calc(100% - 260px); box-sizing: border-box; }
    .card { background: #121214; border: 1px solid #27272a; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    input { width: 100%; padding: 0.75rem; background: #18181b; border: 1px solid #27272a; border-radius: 6px; color: #fff; margin-bottom: 1rem; box-sizing: border-box; }
    button { background: #22c55e; color: #000; font-weight: bold; border: none; padding: 0.75rem; border-radius: 6px; cursor: pointer; width: 100%; }
    .item { background: #18181b; padding: 1rem; border-radius: 6px; border: 1px solid #27272a; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <div class="sidebar">
    <a class="brand" href="/dashboard/students">impetus.</a>
    <span style="color: #4ade80; font-size: 0.9rem;">♙ Alunos</span>
  </div>
  <div class="main">
    <h1>Gestão de Alunos</h1>
    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;">
      <div class="card">
        <h3>Novo Aluno</h3>
        <form id="form">
          <input type="text" id="name" placeholder="Nome Completo" required />
          <input type="email" id="email" placeholder="E-mail" />
          <input type="text" id="goal" placeholder="Objetivo" />
          <button type="submit">Registar Aluno</button>
        </form>
      </div>
      <div class="card">
        <h3>Lista de Alunos</h3>
        <div id="list">A carregar...</div>
      </div>
    </div>
  </div>
  <script>
    async function load() {
      const res = await fetch('/api/students');
      const data = await res.json();
      document.getElementById('list').innerHTML = data.map(s => \`
        <div class="item">
          <div><strong>\${s.name}</strong><br><span style="color: #a1a1aa; font-size: 0.8rem;">\${s.email} • \${s.goal}</span></div>
          <span style="background: #052e16; color: #4ade80; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">\${s.status}</span>
        </div>
      \`).join('');
    }
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          goal: document.getElementById('goal').value
        })
      });
      document.getElementById('form').reset();
      load();
    };
    load();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('Servidor Impetus a correr na porta ' + PORT));
