import {
  readPersonalProfile,
  updatePersonalProfileName,
} from '../db/scoped-prisma';

export type PersonalProfile = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string };
};

export type PersonalProfileRepository = {
  read: (userId: string, tenantId: string) => Promise<PersonalProfile | null>;
  updateName: (
    userId: string,
    tenantId: string,
    name: string,
  ) => Promise<PersonalProfile | null>;
};

const repository: PersonalProfileRepository = {
  read: readPersonalProfile,
  updateName: updatePersonalProfileName,
};

export class PersonalProfileNotFoundError extends Error {
  constructor() {
    super('Perfil de personal não encontrado');
    this.name = 'PersonalProfileNotFoundError';
  }
}

export class PersonalProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonalProfileValidationError';
  }
}

function requireIdentity(userId: string, tenantId: string) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new PersonalProfileValidationError('userId autenticado é obrigatório');
  }
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new PersonalProfileValidationError('tenantId autenticado é obrigatório');
  }
}

export class PersonalProfileService {
  constructor(private readonly data: PersonalProfileRepository = repository) {}

  async getProfile(userId: string, tenantId: string) {
    requireIdentity(userId, tenantId);
    const profile = await this.data.read(userId, tenantId);
    if (!profile) throw new PersonalProfileNotFoundError();
    return {
      id: profile.id,
      name: profile.name,
      email: profile.user.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async updateProfile(userId: string, tenantId: string, input: { name: string }) {
    requireIdentity(userId, tenantId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new PersonalProfileValidationError('Dados do perfil inválidos');
    }

    const keys = Object.keys(input);
    if (keys.some((key) => key !== 'name')) {
      throw new PersonalProfileValidationError('Só é permitido alterar o nome do perfil');
    }
    if (typeof input.name !== 'string') {
      throw new PersonalProfileValidationError('name deve ser texto');
    }
    const name = input.name.trim();
    if (name.length < 2 || name.length > 120) {
      throw new PersonalProfileValidationError('name deve ter entre 2 e 120 caracteres');
    }

    const profile = await this.data.updateName(userId, tenantId, name);
    if (!profile) throw new PersonalProfileNotFoundError();
    return {
      id: profile.id,
      name: profile.name,
      email: profile.user.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
