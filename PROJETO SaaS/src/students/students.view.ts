export function renderStudentsPage(req: any, res: any) {
  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Impetus - Gestão de Alunos</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; display: flex; }
    .sidebar { width: 260px; background: #121214; border-right: 1px solid #27272a; height: 100vh; padding: 1.5rem; position: fixed; box-sizing: border-box; }
    .brand { font-size: 1.25rem; font-weight: bold; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem; }
    .side-link { display: block; padding: 0.75rem 1rem; color: #a1a1aa; text-decoration: none; border-radius: 6px; margin-bottom: 0.25rem; font-size: 0.9rem; }
    .side-link:hover, .side-link.active { background: #27272a; color: #fff; }
    .main { margin-left: 260px; padding: 2rem; width: calc(100% - 260px); max-width: 1200px; box-sizing: border-box; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; color: #fff; }
    p.eyebrow { font-size: 0.75rem; color: #a1a1aa; letter-spacing: 0.05em; text-transform: uppercase; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-top: 2rem; }
    .card { background: #121214; border: 1px solid #27272a; border-radius: 8px; padding: 1.5rem; }
    input { width: 100%; padding: 0.75rem; background: #18181b; border: 1px solid #27272a; border-radius: 6px; color: #fff; margin-top: 0.3rem; margin-bottom: 1rem; box-sizing: border-box; }
    label { font-size: 0.85rem; color: #a1a1aa; display: block; }
    button { background: #22c55e; color: #000; font-weight: bold; border: none; padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; width: 100%; }
    button:hover { background: #16a34a; }
    .student-item { background: #18181b; border: 1px solid #27272a; padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
    .badge { background: #052e16; color: #4ade80; border: 1px solid #14532d; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <a class="brand" href="/dashboard/students"><span>impetus.</span></a>
    <a class="side-link active" href="/dashboard/students">♙ Alunos</a>
  </aside>
  <main class="main">
    <p class="eyebrow">Gestão de Clientes</p>
    <h1>Alunos ativos e acompanhamento</h1>
    
    <div class="grid">
      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Adicionar Novo Aluno</h3>
        <form id="studentForm">
          <label>Nome Completo *</label>
          <input type="text" id="name" placeholder="Ex: Carlos Silva" required />
          <label>E-mail</label>
          <input type="email" id="email" placeholder="carlos@email.com" />
          <label>Objetivo Principal</label>
          <input type="text" id="goal" placeholder="Ex: Hipertrofia / Emagrecimento" />
          <button type="submit">Registar Aluno</button>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top: 0; color: #fff;">Lista de Alunos</h3>
        <div id="studentsList" style="color: #a1a1aa;">A carregar alunos...</div>
      </div>
    </div>
  </main>

  <script>
    async function loadStudents() {
      try {
        const res = await fetch('/api/students');
        const students = await res.json();
        const container = document.getElementById('studentsList');
        
        if (students.length === 0) {
          container.innerHTML = '<p style="color: #a1a1aa;">Nenhum aluno registado ainda.</p>';
          return;
        }

        container.innerHTML = students.map(s => \`
          <div class="student-item">
            <div>
              <strong style="display: block; color: #fff;">\${s.name}</strong>
              <span style="font-size: 0.8rem; color: #a1a1aa;">\${s.email || 'Sem e-mail'} • Objetivo: \${s.goal}</span>
            </div>
            <span class="badge">\${s.status}</span>
          </div>
        \`).join('');
      } catch (err) {
        console.error(err);
      }
    }

    document.getElementById('studentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const goal = document.getElementById('goal').value;

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, goal })
      });

      if (res.ok) {
        document.getElementById('studentForm').reset();
        loadStudents();
      }
    });

    loadStudents();
  </script>
</body>
</html>`);
}
