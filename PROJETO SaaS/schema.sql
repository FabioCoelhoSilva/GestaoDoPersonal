-- Estrutura da Base de Dados - GestaoDoPersonal

-- Tabela de Utilizadores (Personal Trainers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Alunos (associados a um Personal Trainer)
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    personal_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Exercícios (Catálogo geral ou personalizado)
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    muscle_group VARCHAR(100),
    description TEXT
);

-- Tabela de Fichas de Treino (Módulo Workout-Sheet)
CREATE TABLE IF NOT EXISTS workout_sheets (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    week_day VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de ligação entre Ficha de Treino e Exercícios (Séries, repetições e cargas)
CREATE TABLE IF NOT EXISTS workout_exercises (
    id SERIAL PRIMARY KEY,
    workout_sheet_id INT REFERENCES workout_sheets(id) ON DELETE CASCADE,
    exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
    sets INT NOT NULL,
    reps VARCHAR(50) NOT NULL,
    weight DECIMAL(5,2),
    notes TEXT
);