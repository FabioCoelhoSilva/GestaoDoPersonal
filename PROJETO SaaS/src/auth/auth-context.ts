export type AuthContext = {
  userId: string;
  subject: string;
  role: 'ADMIN' | 'PERSONAL' | 'STUDENT';
  tenantId: string | null;
  personalId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      tenantId?: string;
    }
  }
}
