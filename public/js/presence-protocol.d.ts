export type ClientMessageType = 'hello' | 'heartbeat' | 'focus' | 'bye';
export type ServerMessageType = 'roster' | 'tenant-roster' | 'error';
export type MessageType = ClientMessageType | ServerMessageType;

export interface BaseMessage { type: MessageType }
export interface RosterUser  { userId: string; name?: string | null; photoUrl?: string | null; focusItemId?: string | null; joinedAt?: number; role?: 'inspector' | 'observer' }
export interface HelloMessage  extends BaseMessage { type: 'hello'; userId: string; name: string; photoUrl: string | null }
export interface HeartbeatMessage extends BaseMessage { type: 'heartbeat' }
export interface FocusMessage   extends BaseMessage { type: 'focus'; itemId: string | null }
export interface ByeMessage     extends BaseMessage { type: 'bye' }
export interface RosterMessage  extends BaseMessage { type: 'roster';        users:   RosterUser[] }
export interface TenantRosterMessage extends BaseMessage { type: 'tenant-roster'; members: Record<string, { online: boolean; currentInspectionId: string | null; lastSeenAt: number }> }
export interface ErrorMessage   extends BaseMessage { type: 'error'; code: string; message: string }

export type AnyMessage = HelloMessage | HeartbeatMessage | FocusMessage | ByeMessage | RosterMessage | TenantRosterMessage | ErrorMessage;

export function encodeMessage(msg: AnyMessage | Record<string, unknown>): string;
export function decodeMessage(raw: string): AnyMessage | null;
export function rosterDiff<T extends { userId: string }>(prev: T[], next: T[]): { joined: T[]; left: T[] };
