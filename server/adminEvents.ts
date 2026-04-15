import type { Server as SocketServer } from "socket.io";

let _io: SocketServer | null = null;

export function setAdminIo(io: SocketServer) {
  _io = io;
}

export function emitAdminEvent(event: string, data: any) {
  if (_io) {
    _io.to("admin_room").emit(event, data);
  }
}
