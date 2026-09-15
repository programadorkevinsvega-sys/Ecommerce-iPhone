export type CustomerAccountRow = Readonly<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  whatsapp: string | null;
  country_code: string;
  password_hash: string | null;
}>;

export interface CustomerAccountRepository {
  findAccountByEmail(email: string): Promise<CustomerAccountRow | null>;
  findAccountById(id: string): Promise<CustomerAccountRow | null>;
  createAccount(input: { email: string; firstName: string; lastName: string; phone: string; whatsapp: string; countryCode: string; passwordHash: string }): Promise<string>;
  updateAccount(id: string, input: { firstName: string; lastName: string; phone: string; whatsapp: string; countryCode: string }): Promise<void>;
  setPassword(id: string, passwordHash: string): Promise<void>;
  createPasswordReset(id: string, tokenHash: string, expiresAt: string): Promise<void>;
  consumePasswordReset(tokenHash: string): Promise<string | null>;
}
