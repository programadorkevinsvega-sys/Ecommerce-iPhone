export interface TechnicianTokenHasher {
  hash(token: string): Promise<string>;
}
