export * from './stub';
export * from './center';

export abstract class RPCService<T = any> {
  rpcClient?: T[];
  rpcRegistered?: boolean;
  register?(): () => Promise<T>;
  get client(): T | undefined {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}
