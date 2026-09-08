import type { Server as SocketServer } from "socket.io";

let activeSocketServer: SocketServer | null = null;

export function registerSocketServer(io: SocketServer): void {
  activeSocketServer = io;
}

export function disconnectUserSockets(userId: string): void {
  if (!activeSocketServer) return;
  activeSocketServer.in(`user:${userId}`).disconnectSockets(true);
}