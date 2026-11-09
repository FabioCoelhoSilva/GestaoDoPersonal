import express from 'express';
import cors from 'cors';
import workoutsRouter from './workouts/workouts.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mock Data / Base de Alunos
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

// Registo do Módulo de Treinos (/api/workouts)
app.use('/api/workouts', workoutsRouter);

// Dashboard Metrics
app.get('/api/dashboard', (req, res) => {
  return res.json({
    activeStudents: studentsList.length,
    workoutPlans: 3,
    sessions: { executed: 12, inProgress: 2, total: 14 },
  });
});

// Painel Gráfico de Treinos (/dashboard/workouts)
app.get('/dashboard/workouts', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Impetus - Prescrição de Treinos</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, sans-serif; margin: 0; display: flex; }
    .sidebar { width: 260px; background: #121214; border-right: 1px solid #27272a; height: 100vh; padding: 1.5rem; position: fixed; box-sizing: border-box; }
    .brand { font-size: 1.25rem; font-weight: bold; color: #fff; text-decoration: none; margin-bottom: 2rem; display: block; }
    .side-link { display: block; padding: 0.75rem 1rem; color: #a1a1aa; text-decoration: none; border-radius: 6px; margin-bottom: 0.25rem; font-size: 0.9rem; }
    .side-link:hover, .side-link.active { background: #27272a; color: #fff; }
    .main { margin-left: 260px; padding: 2rem; width: calc(100% - 260px); box-sizing: border-box; max-width: 1200px; }
    h1 { font-size: 1.75rem; color: #fff; margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-top: 2rem; }
    .card { background: #121214; border: 1px solid #27272a; border-radius: 8px; padding: 1.5rem; }
    input, textarea { width: 100%; padding: 0.75rem; background: #18181b; border: 1px solid #27272a; border-radius: 6px; color: #fff; margin-top: 0.3rem; margin-bottom: 1rem; box-sizing: border-box; }
    label { font-size: 0.85rem; color: #a1a1aa; display: block; }
    button { background: #22c55e; color: #000; font-weight: bold; border: none; padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; width: 100%; }
    button:hover { background: #16a34a; }
    .workout-item { background: #18181b; border: 1px solid #27272a; padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem; }
    .badge { background: #052e16; color: #4ade80; border: 1px solid #14532d; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <a class="brand" href="/dashboard/workouts">impetus.</a>
    <a class="side-link" href="/dashboard/students">♙ Alunos</a>
    <a class="side-link active" href="/dashboard/workouts">⚡ Planos de Treino</a>
  </aside>
  <main class="main">
    <p style="font-size: 0.75rem; color: #a1a1aa; text-transform: uppercase; margin: 0;">Prescrição Científica</p>
    <h1>Blocos de Hipertrofia & Treinos</h1>
    
    <div class="grid">
      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Novo Plano de Treino</h3>
        <form id="workoutForm">
          <label>Título do Treino *</label>
          <input type="text" id="title" placeholder="Ex: Treino A - Membros Superiores" required />
          <label>Descrição / Foco</label>
          <textarea id="description" placeholder="Ex: Foco em sobrecarga progressiva e RPE 9"></textarea>
          <button type="submit">Prescrever Treino</button>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Planos Prescritos</h3>
        <div id="workoutsList" style="color: #a1a1aa;">A carregar treinos...</div>
      </div>
    </div>
  </main>

  <script>
    async function loadWorkouts() {
      try {
        const res = await fetch('/api/workouts');
        const workouts = await res.json();
        const container = document.getElementById('workoutsList');
        
        if (workouts.length === 0) {
          container.innerHTML = '<p style="color: #a1a1aa;">Nenhum plano de treino prescrito ainda.</p>';
          return;
        }

        container.innerHTML = workouts.map(w => \`
          <div class="workout-item">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <strong style="color: #fff; font-size: 1rem; display: block;">\${w.title}</strong>
                <span style="font-size: 0.8rem; color: #a1a1aa;">\${w.description}</span>
              </div>
              <span class="badge">\${w.status}</span>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        console.error(err);
      }
    }

    document.getElementById('workoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value;
      const description = document.getElementById('description').value;

      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, exercises: [] })
      });

      if (res.ok) {
        document.getElementById('workoutForm').reset();
        loadWorkouts();
      }
    });

    loadWorkouts();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('Servidor Impetus a correr na porta ' + PORT));
