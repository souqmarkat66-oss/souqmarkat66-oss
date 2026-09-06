declare module "node-media-server" {
  export default class NodeMediaServer {
    constructor(config: Record<string, unknown>);
    on(eventName: string, listener: (...args: any[]) => void): void;
    run(): void;
  }
}