import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import workoutsRouter from './workouts/workouts.routes.js';
import exercisesRouter from './exercises/exercises.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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

// Registos das Rotas Core
app.use('/api/workouts', workoutsRouter);
app.use('/api/exercises', exercisesRouter);

app.get('/dashboard/workouts', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Impetus - Prescrição de Treinos & Pack Visual</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, sans-serif; margin: 0; display: flex; }
    .sidebar { width: 260px; background: #121214; border-right: 1px solid #27272a; height: 100vh; padding: 1.5rem; position: fixed; box-sizing: border-box; }
    .brand { font-size: 1.25rem; font-weight: bold; color: #fff; text-decoration: none; margin-bottom: 2rem; display: block; }
    .side-link { display: block; padding: 0.75rem 1rem; color: #a1a1aa; text-decoration: none; border-radius: 6px; margin-bottom: 0.25rem; font-size: 0.9rem; }
    .side-link:hover, .side-link.active { background: #27272a; color: #fff; }
    .main { margin-left: 260px; padding: 2rem; width: calc(100% - 260px); box-sizing: border-box; max-width: 1200px; }
    h1 { font-size: 1.75rem; color: #fff; margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem; }
    .card { background: #121214; border: 1px solid #27272a; border-radius: 8px; padding: 1.5rem; }
    .exercise-badge { background: #18181b; border: 1px solid #27272a; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <a class="brand" href="/dashboard/workouts">impetus.</a>
    <a class="side-link" href="/dashboard/students">♙ Alunos</a>
    <a class="side-link active" href="/dashboard/workouts">⚡ Planos de Treino</a>
  </aside>
  <main class="main">
    <p style="font-size: 0.75rem; color: #22c55e; text-transform: uppercase; margin: 0; font-weight: bold;">Integração Pack Gráfico Ativa</p>
    <h1>Biblioteca de Exercícios & Prescrição</h1>
    
    <div class="grid">
      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Acervo do Pack de Exercícios</h3>
        <p style="font-size: 0.85rem; color: #a1a1aa;">Exercícios mapeados com suporte ao seu acervo visual:</p>
        <div id="exercisesLibrary">A carregar biblioteca...</div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Planos Ativos</h3>
        <div id="workoutsList" style="color: #a1a1aa;">A carregar treinos...</div>
      </div>
    </div>
  </main>

  <script>
    async function loadData() {
      const exRes = await fetch('/api/exercises');
      const exercises = await exRes.json();
      document.getElementById('exercisesLibrary').innerHTML = exercises.map(ex => \`
        <div class="exercise-badge">
          <div>
            <strong style="color: #fff; display: block; font-size: 0.9rem;">\${ex.name}</strong>
            <span style="font-size: 0.75rem; color: #a1a1aa;">Categoria: \${ex.category}</span>
          </div>
          <span style="font-size: 0.7rem; background: #052e16; color: #4ade80; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #14532d;">Pack Ativo</span>
        </div>
      \`).join('');

      const wRes = await fetch('/api/workouts');
      const workouts = await wRes.json();
      document.getElementById('workoutsList').innerHTML = workouts.map(w => \`
        <div style="background: #18181b; padding: 1rem; border-radius: 6px; border: 1px solid #27272a; margin-bottom: 0.5rem;">
          <strong style="color: #fff;">\${w.title}</strong>
          <p style="font-size: 0.8rem; color: #a1a1aa; margin: 0.2rem 0 0 0;">\${w.description}</p>
        </div>
      \`).join('');
    }
    loadData();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('Servidor Impetus a correr na porta ' + PORT));
