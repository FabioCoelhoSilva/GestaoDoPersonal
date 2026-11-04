import { query } from '../db/database';

export interface CreateStudentInput {
  personalId: number;
  name: string;
  email?: string;
  phone?: string;
}

export class StudentService {
  
  /**
   * Cria um novo aluno associado a um Personal Trainer
   */
  public async createStudent(input: CreateStudentInput) {
    if (!input.personalId || !input.name) {
      throw new Error("O ID do personal trainer e o nome do aluno são obrigatórios.");
    }

    const sql = `
      INSERT INTO students (personal_id, name, email, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const values = [input.personalId, input.name, input.email || null, input.phone || null];
    const result = await query(sql, values);
    
    return result.rows[0];
  }

  /**
   * Lista todos os alunos de um determinado Personal Trainer
   */
  public async getStudentsByPersonal(personalId: number) {
    const sql = `SELECT * FROM students WHERE personal_id = $1 ORDER BY name ASC;`;
    const result = await query(sql, [personalId]);
    return result.rows;
  }
}