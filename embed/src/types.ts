export type BadgeKind = 'none' | 'cockade' | 'seal';

export interface CommentItem {
  id: string;
  imageId: string;
  rootId: string;
  parentId: string | null;
  nickname: string;
  content: string;
  html: string;
  createdAt: number;
  likeCount: number;
  likedByMe: boolean;
  verified?: boolean;
  authorBadge?: BadgeKind | null;
  authorAvatar?: string | null;
  ownedByMe?: boolean;
  editable?: boolean;
}

export interface AccountUser {
  id: string;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  badge: BadgeKind;
  displayName: string;
  hasPassword: boolean;
  googleLinked: boolean;
  avatar: string | null;
}

export interface CommentAppState {
  imageId: string;
  viewerId: string;
  adminToken: string;
  replyTo: CommentItem | null;
  comments: CommentItem[];
  loadedImageId: string;
  loading: boolean;
  loadAgain: boolean;
  loadError: string;
  previewing: boolean;
}

export interface ParentMessage {
  type?: string;
  imageId?: string;
  viewerId?: string;
  token?: string;
  theme?: 'light' | 'dark';
}

export type PullPhase = 'start' | 'move' | 'end' | 'cancel';

export interface PullMessage {
  type: 'comment-ui:pull';
  phase: PullPhase;
  deltaY?: number;
  velocityY?: number;
}

export type ParentOutboundMessage =
  | { type: 'comment-ui:ready' }
  | { type: 'comment-ui:loaded'; imageId: string; commentCount: number; commentedByMe?: boolean }
  | { type: 'comment-ui:close' }
  | { type: 'comment-ui:request-admin' }
  | PullMessage;
