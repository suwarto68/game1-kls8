export interface Player {
  name: string;
  className: string;
  avatar: string;
  score: number;
  lives: number;
  maxLives: number;
  currentLevel: number; // 1-7 (7 is final boss)
  unlockedLevels: number[]; // e.g. [1] initially
  badges: string[]; // Badge IDs earned
  answersHistory: Record<string, { questionId: string; selected: string; isCorrect: boolean }[]>;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  levelRequired?: number;
  scoreRequired?: number;
}

export type QuestionType = 
  | "PILIHAN_GANDA" 
  | "BENAR_SALAH" 
  | "ISIAN_SINGKAT" 
  | "DRAG_DROP" 
  | "MENJODOHKAN" 
  | "KOORDINAT_PUZZLE";

export interface MatchingPair {
  leftId: string;
  leftText: string;
  rightId: string;
  rightText: string;
}

export interface Coordinate {
  x: number;
  y: number;
}

// Interactive SVG visual options
export interface VisualData {
  type: "diagram_panah" | "pasangan_berurutan" | "chart_frekuensi" | "grafik_kartesius" | "pasangan_tabel" | "kuartil_box" | "freq_table";
  // Data structure depending on visual type
  arrowDiagram?: {
    domain: { id: string; label: string }[];
    kodomain: { id: string; label: string }[];
    relations: { from: string; to: string }[];
  };
  cartesiusGraph?: {
    points?: { x: number; y: number; label?: string }[];
    lineEquation?: { m: number; c: number; label?: string }; // y = mx + c
    showGrid?: boolean;
    targetPoint?: Coordinate;
  };
  freqTable?: {
    headers: string[];
    rows: [number, number][]; // [nilai, frekuensi]
  };
  boxplot?: {
    min: number;
    q1: number;
    q2: number;
    q3: number;
    max: number;
  };
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  storySegment: string; // The adventure narrative context
  difficulty: "Mudah" | "Sedang" | "HOTS";
  topic: string;
  
  // Standard choices for PILIHAN_GANDA or BENAR_SALAH
  options?: string[];
  correctAnswer?: string; // Plain string representation (e.g. "A", "Benar", or specific value)
  
  // For ISIAN_SINGKAT
  acceptedAnswers?: string[]; // strings or lowercase equivalents
  
  // For MENJODOHKAN (Matching)
  matchingLeft?: string[];
  matchingRight?: string[]; // In shuffled order
  matchingCorrect?: Record<string, string>; // LHS ID -> RHS ID
  
  // For DRAG_DROP (Ordering or Categorizing)
  dragItems?: { id: string; text: string; group?: string }[];
  dropZones?: { id: string; label: string; correctItemIds?: string[] }[];
  
  // For KOORDINAT_PUZZLE (interactive click coordinates)
  targetCoordinates?: Coordinate[];
  gridLimits?: { minX: number; maxX: number; minY: number; maxY: number };

  // Dynamic visual render instruction
  visual?: VisualData;
  explanationHint?: string; // Predefined short explanation
}

export interface GameLevel {
  id: number;
  name: string;
  environment: string; // "Hutan", "Sungai", "Tebing", "Jembatan", "Desa", "Gua", "Candi"
  description: string;
  storyIntro: string;
  storyOutro: string;
  questions: Question[];
  themeColor: string; // Tailwind color class e.g., "emerald", "sky"
  bgGradient: string; // Tailwind gradient classes
  soundAmbience: string; // Description of standard synthesizer sound
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  className: string;
  avatar: string;
  score: number;
  levelsCompleted: number;
  completedAt: string;
}
