import { EventEmitter } from "events";

export interface WalletUpdatePayload {
  userId: string;
  amountEGP: number;
  type: string;
  description: string | null;
  newBalance?: number;
}

export const walletEmitter = new EventEmitter();
walletEmitter.setMaxListeners(50);
