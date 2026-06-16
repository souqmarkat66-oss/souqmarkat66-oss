import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return sharedSocket;
}

export function useWalletSocket(userId: string | undefined) {
  const queryClient = useQueryClient();
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    const joinRoom = () => {
      if (!joinedRef.current) {
        socket.emit("join-user-room", userId);
        joinedRef.current = true;
      }
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on("connect", joinRoom);
    }

    socket.on("wallet:update", (payload: {
      amountEGP: number;
      type: string;
      description: string | null;
      newBalance: number;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue"] });
    });

    return () => {
      socket.off("connect", joinRoom);
      socket.off("wallet:update");
      joinedRef.current = false;
    };
  }, [userId, queryClient]);
}
