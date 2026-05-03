declare module 'midtrans-client' {
  class Snap {
    constructor(config: { isProduction: boolean; serverKey: string; clientKey?: string });
    createTransaction(param: any): Promise<{ token: string; redirect_url: string }>;
    createTransactionToken(param: any): Promise<string>;
  }
  const _default: { Snap: typeof Snap };
  export default _default;
}
