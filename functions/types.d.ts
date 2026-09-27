/**
 * Cloudflare Workers & Pages Functions Ambient Types
 */

declare interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<{ results?: T[]; meta?: any; success?: boolean }>;
  run<T = any>(): Promise<{ results?: T[]; meta?: any; success?: boolean }>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

declare interface R2Object {
  key: string;
  size: number;
}

declare interface R2Bucket {
  put(key: string, value: any, options?: any): Promise<R2Object>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<any>;
}
