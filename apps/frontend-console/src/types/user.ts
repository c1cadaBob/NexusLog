export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  remember?: boolean;
}
