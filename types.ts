
export type NodeType = 'folder' | 'lesson';

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
}

export interface ForumComment {
  id: string;
  nodeId: string;
  author: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  isAdmin: boolean;
}

export interface BookNode {
  id: string;
  title: string;
  type: NodeType;
  url: string;
  imageUrl?: string;
  parentId: string | null;
  lessonResources: ResourceLink[];
  order: number;
}

export interface AppData {
  nodes: BookNode[];
  globalResources: ResourceLink[];
  homeUrl?: string; // Link trang chào mừng/trang chủ
}

export interface Flashcard {
  id: string;
  nodeId: string;
  front: string;
  back: string;
  createdAt?: string;
}

export interface Student {
  id: string;
  name: string;
  full_name?: string;
  password?: string;
  grade_id: number;
  is_guest?: boolean;
}

export interface StudyLog {
  id: string;
  student_id: string;
  node_id: string;
  type: 'material' | 'flashcard' | 'quiz';
  duration: number; // in seconds
  created_at: string;
}

export interface LessonTask {
  id: string;
  nodeId: string;
  description: string;
  minMaterialTime: number; // minutes
  minFlashcardTime: number; // minutes
  minQuizTime: number; // minutes
  createdAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Subject {
  id: number;
  label: string;
  color: string;
  shadow: string;
  theme: string;
  password?: string;
  layout?: 'layout1' | 'layout2' | 'layout3';
}

