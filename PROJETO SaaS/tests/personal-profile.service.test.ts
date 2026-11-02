import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PersonalProfileNotFoundError,
  PersonalProfileService,
  PersonalProfileValidationError,
} from '../src/profile/personal-profile.service';

const now = new Date('2026-01-01T00:00:00.000Z');
const profile = {
  id: 'tenant-1',
  name: 'Trainer One',
  createdAt: now,
  updatedAt: now,
  user: { email: 'trainer@example.com' },
};

const read = vi.fn(async () => profile);
const updateName = vi.fn(async (_userId: string, _tenantId: string, name: string) => ({
  ...profile,
  name,
  user: profile.user,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PersonalProfileService', () => {
  it('reads only the profile returned for the authenticated user and tenant', async () => {
    const service = new PersonalProfileService({ read, updateName });

    await expect(service.getProfile('user-1', 'tenant-1')).resolves.toEqual({
      id: 'tenant-1',
      name: 'Trainer One',
      email: 'trainer@example.com',
      createdAt: now,
      updatedAt: now,
    });
    expect(read).toHaveBeenCalledWith('user-1', 'tenant-1');
  });

  it('normalizes and updates the display name for the authenticated profile', async () => {
    const service = new PersonalProfileService({ read, updateName });

    await expect(service.updateProfile('user-1', 'tenant-1', { name: '  Trainer Two ' }))
      .resolves.toMatchObject({ id: 'tenant-1', name: 'Trainer Two' });
    expect(updateName).toHaveBeenCalledWith('user-1', 'tenant-1', 'Trainer Two');
  });

  it('rejects attempts to modify email, role, or tenant identifiers', async () => {
    const service = new PersonalProfileService({ read, updateName });

    await expect(service.updateProfile('user-1', 'tenant-1', {
      name: 'Trainer Two',
      email: 'attacker@example.com',
    } as never)).rejects.toBeInstanceOf(PersonalProfileValidationError);
    await expect(service.updateProfile('user-1', 'tenant-1', {
      name: 'Trainer Two',
      personalId: 'tenant-2',
    } as never)).rejects.toThrow(/Só é permitido alterar o nome/);
    expect(updateName).not.toHaveBeenCalled();
  });

  it('rejects malformed names and maps missing tenant-owned profiles', async () => {
    const service = new PersonalProfileService({ read, updateName });

    await expect(service.updateProfile('user-1', 'tenant-1', { name: ' ' }))
      .rejects.toBeInstanceOf(PersonalProfileValidationError);
    read.mockResolvedValueOnce(null as never);
    await expect(service.getProfile('user-1', 'tenant-1'))
      .rejects.toBeInstanceOf(PersonalProfileNotFoundError);
    expect(updateName).not.toHaveBeenCalled();
  });
});
