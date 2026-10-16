export interface Rule {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'url';
  required?: boolean;
  default?: string;
  enum?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  protocols?: string[];
  description?: string;
}
export interface Contract { version: 1; variables: Record<string, Rule>; additionalProperties?: boolean }
export type IssueCode = 'required' | 'type' | 'enum' | 'min' | 'max' | 'minLength' | 'maxLength' | 'unknown';
export interface Report { valid: boolean; checked: number; defaultsUsed: string[]; issues: { key: string | null; code: IssueCode; count?: number }[] }
export class ContractError extends Error {}
export function assertContract(schema: unknown): Contract;
export function validate(schema: Contract, values: Record<string, string | undefined>): Report;
export function parseEnv(text: string): Record<string, string>;
