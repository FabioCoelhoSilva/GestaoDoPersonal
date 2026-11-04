import { describe, it, expect } from 'vitest';
import { DashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardService - Testes Unitários', () => {
  it('deve lançar um erro se o tenantId estiver vazio', () => {
    expect(() => new DashboardService('')).toThrow('getScopedPrisma: tenantId obrigatório');
  });
});
