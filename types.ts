
export enum View {
  HOME = 'HOME',
  SIMULATOR = 'SIMULATOR',
  CRITIQUE = 'CRITIQUE',
  CHAT = 'CHAT',
  LEARNING_BOX = 'LEARNING_BOX',
  REGISTRATION = 'REGISTRATION',
  ADMIN = 'ADMIN'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

export interface SimulatorSettings {
  aperture: number; // f-stop
  shutterSpeed: number; // denominator (e.g., 60 for 1/60)
  iso: number;
}

export interface CritiqueResult {
  exposure: string;
  composition: string;
  technical: string;
  general: string;
}

export interface LearningMaterial {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video';
  name: string;
  content: string; // Base64 for images/audio/video, string for text
  mimeType?: string;
  isAnalyzed?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Registration {
  id: string;
  date: string;
  fullName: string;
  email: string;
  phone: string;
  level: string;
  status: 'pending' | 'contacted';
}
