import express, { RequestHandler } from 'express';
import { once } from 'node:events';
import { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkoutExecutionRouter } from '../src/students/workout-execution.routes';

const createExecution = vi.fn(async (_tenantId: string, input: { studentId: string }) => ({
  id: 'execution-1',
  studentId: input.studentId,
}));
const listExecutions = vi.fn(async () => []);
const completeExecution = vi.fn(async (_tenantId: string, executionId: string) => ({
  id: executionId,
  status: 'COMPLETED',
}));
let role: 'PERSONAL' | 'STUDENT' = 'STUDENT';
let tenantId = 'tenant-1';
let authenticatedStudentId: string | null = 'student-1';
let server: Server;
let baseUrl: string;

const injectAuth: RequestHandler = (req, _res, next) => {
  req.tenantId = tenantId;
  req.auth = {
    userId: role === 'STUDENT' ? 'student-user' : 'personal-user',
    subject: 'test-subject',
    role,
    tenantId,
    personalId: tenantId,
    studentId: role === 'STUDENT' ? authenticatedStudentId : null,
  };
  next();
};

beforeEach(async () => {
  role = 'STUDENT';
  tenantId = 'tenant-1';
  authenticatedStudentId = 'student-1';
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use('/api', injectAuth);
  app.use('/api', createWorkoutExecutionRouter({
    createWorkoutExecution: createExecution,
    listWorkoutExecutions: listExecutions,
    completeWorkoutExecution: completeExecution,
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

describe('workout execution routes', () => {
  const body = {
    workoutId: 'workout-1',
    completed: true,
    sets: [{
      workoutExerciseId: 'exercise-1',
      setNumber: 1,
      repsCompleted: 10,
      loadKg: 40,
    }],
  };

  it('derives student identity from authentication when creating an execution', async () => {
    const response = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(201);
    expect(createExecution).toHaveBeenCalledWith('tenant-1', {
      ...body,
      studentId: 'student-1',
    });
  });

  it('does not let a student override the authenticated student id or tenant', async () => {
    const response = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, studentId: 'another-student', personalId: 'tenant-2' }),
    });
    expect(response.status).toBe(400);
    expect(createExecution).not.toHaveBeenCalled();
  });

  it('restricts student history reads to the authenticated student', async () => {
    const response = await fetch(`${baseUrl}/api/workout-executions?studentId=another-student`);
    expect(response.status).toBe(403);
    expect(listExecutions).not.toHaveBeenCalled();

    const ownHistory = await fetch(`${baseUrl}/api/workout-executions`);
    expect(ownHistory.status).toBe(200);
    expect(listExecutions).toHaveBeenCalledWith('tenant-1', 'student-1');
  });

  it('requires a target student when a personal creates an execution', async () => {
    role = 'PERSONAL';
    const response = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);

    const created = await fetch(`${baseUrl}/api/workout-executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, studentId: 'student-2' }),
    });
    expect(created.status).toBe(201);
    expect(createExecution).toHaveBeenCalledWith('tenant-1', {
      ...body,
      studentId: 'student-2',
    });
  });

  it('lets a student complete only their execution without accepting body overrides', async () => {
    const completed = await fetch(
      `${baseUrl}/api/workout-executions/execution-1/complete`,
      { method: 'PATCH' },
    );
    expect(completed.status).toBe(200);
    expect(completeExecution).toHaveBeenCalledWith('tenant-1', 'execution-1', 'student-1');

    const rejected = await fetch(
      `${baseUrl}/api/workout-executions/execution-1/complete`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: 'another-student' }),
      },
    );
    expect(rejected.status).toBe(400);
    expect(completeExecution).toHaveBeenCalledTimes(1);
  });
});
