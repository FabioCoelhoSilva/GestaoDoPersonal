import express, { RequestHandler } from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudentWorkoutRouter } from '../src/students/student-workout.routes';
import {
  StudentWorkoutValidationError,
  TenantStudentNotFoundError,
} from '../src/students/student-workout.service';

const createStudent = vi.fn(async (tenantId: string, data: { name: string; email: string }) => ({
  id: 'student-1',
  personalId: tenantId,
  ...data,
  cpfEncrypted: 'must-not-be-returned',
  cpfHash: 'must-not-be-returned',
}));
const listStudents = vi.fn(async (tenantId: string) => [{
  id: 'student-1',
  personalId: tenantId,
  name: 'Student',
  email: 'student@example.com',
  cpfEncrypted: 'must-not-be-returned',
  cpfHash: 'must-not-be-returned',
}]);
const createWorkoutPlan = vi.fn(async (tenantId: string, data: { studentId: string }) => ({
  id: 'workout-1',
  personalId: tenantId,
  studentId: data.studentId,
  exercises: [],
}));

let server: Server;
let baseUrl: string;

const injectTenant: RequestHandler = (req, _res, next) => {
  req.tenantId = 'tenant-from-auth';
  req.auth = {
    userId: 'user-from-auth',
    subject: 'subject-from-auth',
    role: 'PERSONAL',
    tenantId: 'tenant-from-auth',
    personalId: 'tenant-from-auth',
    studentId: null,
  };
  next();
};

beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use('/api', injectTenant);
  app.use('/api', createStudentWorkoutRouter({
    createStudent,
    listStudents,
    createWorkoutPlan,
  }));
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('student and workout routes', () => {
  it('creates a student with the authenticated tenant and omits protected fields', async () => {
    const response = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: ' Ana ', email: 'ana@example.com' }),
    });

    expect(response.status).toBe(201);
    expect(createStudent).toHaveBeenCalledWith('tenant-from-auth', {
      name: 'Ana',
      email: 'ana@example.com',
    });
    const body = await response.json();
    expect(body.data.personalId).toBe('tenant-from-auth');
    expect(body.data).not.toHaveProperty('cpfEncrypted');
    expect(body.data).not.toHaveProperty('cpfHash');
  });

  it('rejects tenant IDs supplied by the request body', async () => {
    const response = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        personalId: 'tenant-attacker',
      }),
    });

    expect(response.status).toBe(400);
    expect(createStudent).not.toHaveBeenCalled();
  });

  it('lists students for the authenticated tenant only', async () => {
    const response = await fetch(`${baseUrl}/api/students`);

    expect(response.status).toBe(200);
    expect(listStudents).toHaveBeenCalledWith('tenant-from-auth');
    const body = await response.json();
    expect(body.data[0].personalId).toBe('tenant-from-auth');
    expect(body.data[0]).not.toHaveProperty('cpfEncrypted');
    expect(body.data[0]).not.toHaveProperty('cpfHash');
  });

  it('creates a workout plan without accepting a tenant override', async () => {
    const response = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: 'student-1',
        title: 'Plano semanal',
        exercises: [{
          name: 'Agachamento',
          gifUrl: 'https://cdn.example.com/exercises/squat.gif',
          sets: 3,
          reps: '8-12',
          order: 0,
        }],
        tenantId: 'tenant-attacker',
      }),
    });

    expect(response.status).toBe(400);
    expect(createWorkoutPlan).not.toHaveBeenCalled();
  });

  it('returns 201 for a valid workout plan and uses the auth tenant', async () => {
    const response = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: 'student-1',
        title: 'Plano semanal',
        exercises: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
      }),
    });

    expect(response.status).toBe(201);
    expect(createWorkoutPlan).toHaveBeenCalledWith(
      'tenant-from-auth',
      expect.objectContaining({ studentId: 'student-1' }),
    );
  });

  it('maps tenant mismatch to 403 and service validation to 400', async () => {
    createWorkoutPlan.mockRejectedValueOnce(new TenantStudentNotFoundError());
    const forbiddenResponse = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: 'foreign-student',
        title: 'Plano',
        exercises: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
      }),
    });

    expect(forbiddenResponse.status).toBe(403);

    createStudent.mockRejectedValueOnce(new StudentWorkoutValidationError('email inválido'));
    const badRequestResponse = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com' }),
    });
    expect(badRequestResponse.status).toBe(400);
    await expect(badRequestResponse.json()).resolves.toEqual({ error: 'email inválido' });
  });

  it('rejects insecure exercise GIF URLs', async () => {
    const response = await fetch(`${baseUrl}/api/workouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: 'student-1',
        title: 'Plano semanal',
        exercises: [{
          name: 'Agachamento',
          gifUrl: 'http://cdn.example.com/exercises/squat.gif',
          sets: 3,
          reps: '8-12',
          order: 0,
        }],
      }),
    });

    expect(response.status).toBe(400);
    expect(createWorkoutPlan).not.toHaveBeenCalled();
  });

  it('fails closed if the auth middleware does not inject a tenant', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createStudentWorkoutRouter({
      createStudent,
      listStudents,
      createWorkoutPlan,
    }));
    const unauthedServer = app.listen(0);
    await once(unauthedServer, 'listening');
    const address = unauthedServer.address();
    if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP');

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/students`);
      expect(response.status).toBe(401);
      expect(listStudents).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        unauthedServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
