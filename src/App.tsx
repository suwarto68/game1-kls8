import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Compass, 
  Trophy, 
  Heart, 
  Timer, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Sparkles, 
  Map, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  FileText, 
  Database, 
  Lock, 
  Unlock, 
  Send, 
  Share2, 
  LogOut, 
  MapPin, 
  RotateCcw, 
  Info,
  Download,
  Calendar,
  Check,
  ChevronDown
} from "lucide-react";
import { GAME_LEVELS, AVATARS, BADGES } from "./data";
import { Player, GameLevel, Question, LeaderboardEntry, Badge, Coordinate } from "./types";
import { 
  playClick, 
  playCorrect, 
  playWrong, 
  playLevelUp, 
  playVictory, 
  playAmbient, 
  stopAmbient 
} from "./utils/audio";

export default function App() {
  // Theme & Sound Configuration
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("math_adventure_theme");
      return saved === "dark";
    }
    return false;
  });
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Player State
  const [player, setPlayer] = useState<Player | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("math_adventure_player");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  // Entry Form values
  const [username, setUsername] = useState("");
  const [className, setClassName] = useState("VIII A");
  const [chosenAvatar, setChosenAvatar] = useState("petualang1");

  // Game UI Screens
  // "welcome" | "map" | "play" | "certificate" | "leaderboard" | "infographic"
  const [currentScreen, setCurrentScreen] = useState<string>("welcome");
  
  // Game Play States
  const [activeLevel, setActiveLevel] = useState<GameLevel | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [shortAnswer, setShortAnswer] = useState<string>("");
  const [questionTimer, setQuestionTimer] = useState<number>(120); // 120 seconds per question
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrectFeedback, setIsCorrectFeedback] = useState<boolean>(false);
  
  // Custom Drag and Drop representation: Click-to-Assign model
  // Tracks which item is assigned to which zone
  const [dragAssignments, setDragAssignments] = useState<Record<string, string>>({}); // itemId -> zoneId

  // Custom Matching represention:
  const [selectedMatchingLeft, setSelectedMatchingLeft] = useState<string | null>(null);
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string>>({}); // LHS -> RHS

  // Custom Coordinate Puzzle representation:
  const [clickedCoordinate, setClickedCoordinate] = useState<Coordinate | null>(null);

  // AI & Local Explanations
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);

  // Leadearboard & database connection
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);
  const [dbSynced, setDbSynced] = useState<boolean>(false);

  // Boss Combat Visual State
  const [bossHp, setBossHp] = useState<number>(100);
  const [isBossAttacking, setIsBossAttacking] = useState<boolean>(false);
  const [isPlayerHurt, setIsPlayerHurt] = useState<boolean>(false);

  // Load Leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Update classes in DOM for theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("math_adventure_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Persist Player state
  useEffect(() => {
    if (player) {
      localStorage.setItem("math_adventure_player", JSON.stringify(player));
    } else {
      localStorage.removeItem("math_adventure_player");
    }
  }, [player]);

  // Play ambient music based on screen/level
  useEffect(() => {
    if (!audioEnabled) {
      stopAmbient();
      return;
    }

    if (currentScreen === "welcome") {
      playAmbient("river");
    } else if (currentScreen === "map") {
      playAmbient("farm_morning");
    } else if (currentScreen === "play" && activeLevel) {
      playAmbient(activeLevel.soundAmbience);
    } else if (currentScreen === "certificate") {
      playAmbient("farm_morning");
    } else {
      stopAmbient();
    }

    return () => {
      stopAmbient();
    };
  }, [currentScreen, activeLevel, audioEnabled]);

  // Level Question continuous counting timer
  useEffect(() => {
    if (currentScreen !== "play" || isAnswered || !activeLevel) return;

    const interval = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev <= 1) {
          // Timer runs out! Trigger automatic wrong answer
          handleTimerExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentScreen, isAnswered, activeLevel, currentQuestionIndex]);

  const handleTimerExpiry = () => {
    if (isAnswered) return;
    setIsAnswered(true);
    setIsCorrectFeedback(false);
    
    // Deduct Life
    setPlayer((prev) => {
      if (!prev) return null;
      const nextLives = Math.max(0, prev.lives - 1);
      return {
        ...prev,
        lives: nextLives
      };
    });

    if (audioEnabled) playWrong();
    
    // Auto outline response
    const q = activeLevel?.questions[currentQuestionIndex];
    if (q) {
      setAiExplanation(`### Waktu Habis!\n\nWaktu pengerjaan untuk bagian ini telah habis. Jangan khawatir, mari kita review penjelasannya:\n\n**Jawaban yang Benar:** ${q.correctAnswer}\n\n*Petunjuk:* ${q.explanationHint || "Pelajari kembali konsep materi pelajaran ini."}`);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/scores");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (e) {
      console.warn("Gagal mengambil data leaderboard. Menggunakan local store.", e);
    }
  };

  const syncToSheets = async (playerScore: number, solvedLevels: number) => {
    if (!player) return;
    setIsSubmittingScore(true);
    try {
      const payload = {
        name: player.name,
        className: player.className,
        avatar: player.avatar,
        score: playerScore,
        levelsCompleted: solvedLevels,
        completedAt: new Date().toISOString()
      };

      const res = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setDbSynced(true);
        fetchLeaderboard();
      }
    } catch (e) {
      console.error("Gagal sinkron database:", e);
    } finally {
      setIsSubmittingScore(false);
    }
  };

  // Login click handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    if (audioEnabled) playClick();

    const newPlayer: Player = {
      name: username.trim(),
      className: className,
      avatar: chosenAvatar,
      score: 0,
      lives: 3,
      maxLives: 3,
      currentLevel: 1,
      unlockedLevels: [1],
      badges: ["pioneer"],
      answersHistory: {}
    };

    setPlayer(newPlayer);
    setCurrentScreen("map");
  };

  // Reset progress and log out
  const handleLogOut = () => {
    if (audioEnabled) playClick();
    if (confirm("Apakah kamu ingin mengulang petualangan dari awal dan keluar?")) {
      setPlayer(null);
      setCurrentScreen("welcome");
      setActiveLevel(null);
      setAiExplanation("");
    }
  };

  // Level click navigation from Adventure Map
  const handleSelectLevel = (level: GameLevel) => {
    if (!player) return;
    if (audioEnabled) playClick();

    // Check lock
    if (!player.unlockedLevels.includes(level.id)) {
      alert(`Pos petualangan ${level.name} masih terkunci! Selesaikan pos sebelumnya untuk membuka jalan.`);
      return;
    }

    setActiveLevel(level);
    setCurrentQuestionIndex(0);
    resetQuestionStates();
    setCurrentScreen("play");
  };

  const resetQuestionStates = () => {
    setSelectedOption(null);
    setShortAnswer("");
    setIsAnswered(false);
    setIsCorrectFeedback(false);
    setQuestionTimer(120);
    setDragAssignments({});
    setMatchingPairs({});
    setClickedCoordinate(null);
    setAiExplanation("");
  };

  // Drag and Drop (click-to-assign) items click helper
  const handleAssignDragDrop = (itemId: string, zoneId: string) => {
    if (isAnswered) return;
    if (audioEnabled) playClick();
    setDragAssignments(prev => ({
      ...prev,
      [itemId]: zoneId
    }));
  };

  const handleRemoveDragDrop = (itemId: string) => {
    if (isAnswered) return;
    if (audioEnabled) playClick();
    setDragAssignments(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Matching helper
  const handleMatchingLeftClick = (leftId: string) => {
    if (isAnswered) return;
    if (audioEnabled) playClick();
    setSelectedMatchingLeft(leftId);
  };

  const handleMatchingRightClick = (rightText: string) => {
    if (isAnswered || !selectedMatchingLeft) return;
    if (audioEnabled) playClick();

    setMatchingPairs(prev => ({
      ...prev,
      [selectedMatchingLeft]: rightText
    }));
    setSelectedMatchingLeft(null);
  };

  const handleClearMatchingPairs = () => {
    if (isAnswered) return;
    if (audioEnabled) playClick();
    setMatchingPairs({});
    setSelectedMatchingLeft(null);
  };

  // Coordinate Grid Click Helper
  const handleCartesianGridClick = (x: number, y: number) => {
    if (isAnswered) return;
    if (audioEnabled) playClick();
    setClickedCoordinate({ x, y });
  };

  // Checking Answer
  const handleCheckAnswer = async () => {
    if (!player || !activeLevel || isAnswered) return;

    const question = activeLevel.questions[currentQuestionIndex];
    let isCorrect = false;

    // Validate based on question type
    if (question.type === "PILIHAN_GANDA" || question.type === "BENAR_SALAH") {
      if (!selectedOption) return; // Must select something
      isCorrect = selectedOption.trim() === question.correctAnswer.trim();
    } else if (question.type === "ISIAN_SINGKAT") {
      if (!shortAnswer.trim()) return;
      const cleanAnswer = shortAnswer.trim().toLowerCase();
      const accepted = question.acceptedAnswers?.map(a => a.toLowerCase()) || [question.correctAnswer.toLowerCase()];
      isCorrect = accepted.includes(cleanAnswer);
    } else if (question.type === "DRAG_DROP") {
      // All items must be classified to their correct drop zone
      let matches = true;
      let assignedCount = 0;
      
      question.dropZones?.forEach(zone => {
        zone.correctItemIds?.forEach(itemId => {
          assignedCount++;
          if (dragAssignments[itemId] !== zone.id) {
            matches = false;
          }
        });
      });

      // Confirm everything listed is classified
      isCorrect = matches && (Object.keys(dragAssignments).length === assignedCount);
    } else if (question.type === "MENJODOHKAN") {
      // Match each left to right ID according to matchingCorrect mapping
      let matches = true;
      const leftItems = question.matchingLeft || [];
      if (Object.keys(matchingPairs).length < leftItems.length) {
        alert("Selesaikan semua pencocokan garis sebelum memeriksa!");
        return;
      }
      
      leftItems.forEach(left => {
        const studentRightSelected = matchingPairs[left];
        const correctRightValue = question.matchingCorrect?.[left];
        if (studentRightSelected !== correctRightValue) {
          matches = false;
        }
      });
      isCorrect = matches;
    } else if (question.type === "KOORDINAT_PUZZLE") {
      if (!clickedCoordinate) {
        alert("Minta tolong pilih satu koordinat di grid peta terlebih dahulu!");
        return;
      }
      // Compare clickedCoordinate against targetCoordinates
      isCorrect = question.targetCoordinates?.some(target => target.x === clickedCoordinate.x && target.y === clickedCoordinate.y) || false;
    }

    // Process correctness
    setIsAnswered(true);
    setIsCorrectFeedback(isCorrect);

    let xpEarned = 0;
    if (isCorrect) {
      if (audioEnabled) playCorrect();
      
      // Calculate XP/Score
      const difficultyBonus = question.difficulty === "HOTS" ? 50 : question.difficulty === "Sedang" ? 30 : 20;
      const timeBonus = Math.floor(questionTimer / 3);
      xpEarned = difficultyBonus + timeBonus;

      // Decrement Boss Health if final boss level
      if (activeLevel.id === 7) {
        setBossHp(prev => {
          const nextHp = Math.max(0, prev - 20); // 5 questions, 20% each
          return nextHp;
        });
        setIsBossAttacking(false);
      }

    } else {
      if (audioEnabled) playWrong();
      
      // Deduct health points
      setPlayer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          lives: Math.max(0, prev.lives - 1)
        };
      });

      if (activeLevel.id === 7) {
        // Boss strikes back!
        setIsBossAttacking(true);
        setIsPlayerHurt(true);
        setTimeout(() => {
          setIsBossAttacking(false);
          setIsPlayerHurt(false);
        }, 1500);
      }
    }

    // Save game state
    setPlayer(prev => {
      if (!prev) return null;
      let newScore = prev.score + xpEarned;
      return {
        ...prev,
        score: newScore
      };
    });

    // Request Gemini AI automated explanation using node proxy
    setIsLoadingAI(true);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: question.prompt,
          options: question.options,
          correctAnswer: question.correctAnswer,
          selectedAnswer: selectedOption || shortAnswer || JSON.stringify(dragAssignments) || JSON.stringify(matchingPairs) || (clickedCoordinate ? `(${clickedCoordinate.x}, ${clickedCoordinate.y})` : "Belum diisi"),
          topic: question.topic,
          customHint: question.explanationHint
        })
      });

      if (response.ok) {
        const explData = await response.json();
        setAiExplanation(explData.explanation);
      } else {
        setAiExplanation(`### Tinjau Pembahasan\n\n**Jawaban yang Benar:** ${question.correctAnswer}\n\n*Langkah Solusi:* ${question.explanationHint}`);
      }
    } catch (e) {
      setAiExplanation(`### Tinjau Pembahasan\n\n**Jawaban yang Benar:** ${question.correctAnswer}\n\n*Langkah Solusi:* ${question.explanationHint}`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Advancing to the next question or finishing level
  const handleNextQuestion = () => {
    if (!player || !activeLevel) return;

    // Check if player has no lives left
    if (player.lives <= 0) {
      alert("Energi / Nyawa kamu habis! Kembali ke desa untuk beristirahat dan memulihkan stamina.");
      // Revive player to max lives but return to map
      setPlayer(prev => {
        if (!prev) return null;
        const gotBadge = prev.badges.includes("life_saver") ? prev.badges : [...prev.badges, "life_saver"];
        return {
          ...prev,
          lives: prev.maxLives,
          badges: gotBadge
        };
      });
      setCurrentScreen("map");
      setActiveLevel(null);
      return;
    }

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < activeLevel.questions.length) {
      setCurrentQuestionIndex(nextIndex);
      resetQuestionStates();
    } else {
      // Completed last question of the level!
      handleCompleteLevel();
    }
  };

  const handleCompleteLevel = () => {
    if (!player || !activeLevel) return;

    if (audioEnabled) playLevelUp();

    const playedLevelId = activeLevel.id;
    let nextLevelId = playedLevelId + 1;
    let earnedBadges = [...player.badges];

    // Award Badges based on completed level
    if (playedLevelId === 1 && !earnedBadges.includes("relasi_master")) {
      earnedBadges.push("relasi_master");
    } else if (playedLevelId === 2 && !earnedBadges.includes("sungai_navigator")) {
      earnedBadges.push("sungai_navigator");
    } else if (playedLevelId === 3 && !earnedBadges.includes("tebing_climber")) {
      earnedBadges.push("tebing_climber");
    } else if (playedLevelId === 4 && !earnedBadges.includes("jembatan_builder")) {
      earnedBadges.push("jembatan_builder");
    } else if (playedLevelId === 5 && !earnedBadges.includes("desa_kades")) {
      earnedBadges.push("desa_kades");
    } else if (playedLevelId === 6 && !earnedBadges.includes("gua_explorer")) {
      earnedBadges.push("gua_explorer");
    } else if (playedLevelId === 7 && !earnedBadges.includes("final_boss_slayer")) {
      earnedBadges.push("final_boss_slayer");
      if (audioEnabled) playVictory();
    }

    // Level-specific congratulations
    alert(`Selamat! Kamu telah menyelesaikan pos petualangan: ${activeLevel.name}.\nKamu memperoleh Badge baru dan membuka jalan berikutnya.`);

    // Sync state
    setPlayer(prev => {
      if (!prev) return null;
      let nextUnlocked = [...prev.unlockedLevels];
      if (playedLevelId < 7 && !nextUnlocked.includes(nextLevelId)) {
        nextUnlocked.push(nextLevelId);
      }
      return {
        ...prev,
        unlockedLevels: nextUnlocked,
        badges: earnedBadges,
        currentLevel: Math.max(prev.currentLevel, nextLevelId)
      };
    });

    // If beat Boss, navigate to certificate automatically
    if (playedLevelId === 7) {
      syncToSheets(player.score + 200, 7); // add 200 completion bonus
      setCurrentScreen("certificate");
    } else {
      syncToSheets(player.score, playedLevelId);
      setCurrentScreen("map");
    }

    setActiveLevel(null);
  };

  // Reset current question attempt
  const handleRetakeLevel = () => {
    if (audioEnabled) playClick();
    resetQuestionStates();
  };

  // Helper values
  const currentAvatarInfo = useMemo(() => {
    return AVATARS.find(a => a.id === (player?.avatar || chosenAvatar));
  }, [player, chosenAvatar]);

  // Cartesian grid points generator for SVG
  const gridLines = [];
  for (let idx = -5; idx <= 5; idx++) {
    gridLines.push(idx);
  }

  // Infographic database instructions
  const showGoogleSheetsAlert = () => {
    alert(
      "💻 INTEGRASI DATA PEMAIN:\n\n" +
      "Game ini sudah terintegrasi secara dinamis dengan database lokal Express yang menyimpan ke berkas 'scores.json' di Cloud Run.\n\n" +
      "Untuk mengintegrasikannya langsung dengan Google Sheet milik Anda:\n" +
      "1. Gunakan API webhook pengiriman data di route POST /api/scores.\n" +
      "2. Buat Google Apps Script pada spreadsheet Anda lalu publish sebagai Web App.\n" +
      "3. Hubungkan URL Apps Script tersebut ke konfigurasi backend server."
    );
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-emerald-50/20 bg-gradient-to-b from-teal-50/30 to-emerald-50/10 text-slate-900"}`}>
      
      {/* HEADER NAV */}
      <header className="border-b border-teal-500/10 backdrop-blur-md sticky top-0 z-50 py-3.5 px-4 md:px-8 flex justify-between items-center transition-colors">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => player ? setCurrentScreen("map") : setCurrentScreen("welcome")}>
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center transform hover:scale-105 transition-transform">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="font-extrabold text-lg md:text-xl tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Lintas Alam Matematika
            </span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">SMP Petualang</span>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <button 
            id="theme-toggle"
            onClick={() => { if (audioEnabled) playClick(); setDarkMode(!darkMode); }} 
            className="p-2.5 rounded-lg border border-teal-500/10 hover:bg-emerald-500/10 text-teal-600 dark:text-teal-400 transition"
            title="Ubah Tema Warna"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button 
            id="audio-toggle"
            onClick={() => { setAudioEnabled(!audioEnabled); }} 
            className="p-2.5 rounded-lg border border-teal-500/10 hover:bg-emerald-500/10 text-teal-600 dark:text-teal-400 transition"
            title={audioEnabled ? "Matikan Suara" : "Aktifkan Suara"}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {player && (
            <div className="hidden md:flex items-center space-x-3 bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/10">
              <span className="text-xl">{currentAvatarInfo?.emoji}</span>
              <div className="text-left">
                <p className="text-sm font-bold leading-3 text-slate-800 dark:text-slate-100">{player.name}</p>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider mt-0.5">{player.className}</p>
              </div>
            </div>
          )}

          {player && (
            <button 
              id="logout-btn"
              onClick={handleLogOut} 
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition"
              title="Keluar dari Game"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        
        {/* WELCOME SCREEN */}
        {currentScreen === "welcome" && (
          <div className="animate-fade-in max-w-4xl mx-auto mt-2 md:mt-6">
            
            {/* HERO JUMBOTRON */}
            <div className="relative text-center bg-gradient-to-br from-emerald-900 to-teal-950 py-12 px-6 md:px-12 rounded-3xl shadow-2xl text-white overflow-hidden mb-10 border border-emerald-500/20">
              {/* Decorative backgrounds */}
              <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="relative z-10">
                <span className="inline-block bg-teal-500/20 text-teal-300 font-semibold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest mb-4 border border-teal-500/30">
                  🍃 Game Edukasi Berbasis Petualangan Alam
                </span>
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
                  Lintas Alam <br className="md:hidden" />
                  <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                    Matematika SMP
                  </span>
                </h1>
                <p className="text-slate-300 max-w-2xl mx-auto text-sm md:text-base mb-8 leading-relaxed">
                  Asah kemampuan numerasi, taklukkan teka-teki logika, dan jelajahi indahnya sabana, sungai deras, hingga tebing curam. Belajar matematika yang interaktif, menantang, dan seru!
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a 
                    href="#login-section"
                    onClick={() => { if (audioEnabled) playClick(); }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl shadow-lg transition duration-200 text-sm md:text-base cursor-pointer tracking-wider flex items-center space-x-2"
                  >
                    <span>Mulai Menjelajah</span>
                    <ChevronRight className="w-5 h-5" />
                  </a>
                  <button 
                    id="sheets-guide-btn"
                    onClick={showGoogleSheetsAlert}
                    className="bg-white/10 hover:bg-white/15 text-slate-200 font-bold px-6 py-4 rounded-xl text-xs md:text-sm tracking-wide transition border border-white/15 flex items-center space-x-2"
                  >
                    <Database className="w-4 h-4" />
                    <span>Database Google Sheets</span>
                  </button>
                </div>
              </div>
            </div>

            {/* LOGIN & CUSTOMIZATION */}
            <div id="login-section" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-12">
              
              {/* FORM & AVATAR SELECTION */}
              <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                <h3 className="text-xl md:text-2xl font-extrabold mb-6 flex items-center space-x-3 text-emerald-600">
                  <User className="w-6 h-6" />
                  <span>Daftar Tim Juru Jelajah</span>
                </h3>

                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Name Input */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                      Nama Lengkap Siswa
                    </label>
                    <input 
                      id="player-name-input"
                      type="text" 
                      required 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                    />
                  </div>

                  {/* Class selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                      Kelas SMP
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["VIII A", "VIII B"].map((cls) => (
                        <button
                          id={`class-btn-${cls.replace(/\s+/g, '-')}`}
                          key={cls}
                          type="button"
                          onClick={() => { if (audioEnabled) playClick(); setClassName(cls); }}
                          className={`py-2 px-3 text-xs md:text-sm font-bold rounded-xl border transition ${className === cls ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20" : "bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"}`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avatar Picker */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                      PILIH AVATAR KARAKTER
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {AVATARS.map((av) => (
                        <button
                          id={`avatar-btn-${av.id}`}
                          key={av.id}
                          type="button"
                          onClick={() => { if (audioEnabled) playClick(); setChosenAvatar(av.id); }}
                          className={`flex flex-col items-center p-3.5 rounded-xl border transition ${chosenAvatar === av.id ? "bg-teal-500/10 border-teal-500 ring-2 ring-teal-500/20" : "bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 hover:border-slate-400"}`}
                        >
                          <span className="text-3xl mb-1.5 transform hover:scale-110 transition duration-150">{av.emoji}</span>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{av.name}</span>
                          <span className="text-[9px] text-slate-400 mt-1 text-center">{av.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    id="submit-login-btn"
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition duration-150"
                  >
                    Masuk Dunia Petualangan 🧭
                  </button>
                </form>
              </div>

              {/* LEADERBOARD VIEW ON WELCOME */}
              <div className="md:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black flex items-center space-x-2 text-amber-500 uppercase tracking-wider">
                    <Trophy className="w-5 h-5" />
                    <span>Leaderboard Guru & Siswa</span>
                  </h3>
                  <button 
                    id="refresh-scores-btn"
                    onClick={fetchLeaderboard} 
                    className="p-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Refresh</span>
                  </button>
                </div>

                <div className="overflow-y-auto max-h-96 pr-1 space-y-2 flex-grow custom-scrollbar">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                      <p className="text-xs">Belum ada nilai terdaftar.</p>
                      <p className="text-[10px]">Jadilah penjelajah pertama yang mengukir sejarah!</p>
                    </div>
                  ) : (
                    leaderboard.map((item, index) => {
                      const medalColor = index === 0 ? "text-amber-500 text-base" : index === 1 ? "text-slate-400 text-sm" : index === 2 ? "text-amber-700 text-sm" : "text-slate-400 text-xs";
                      const rankDisplay = index < 3 ? "🏆" : `#${index + 1}`;
                      const av = AVATARS.find(a => a.id === item.avatar)?.emoji || "🎒";
                      return (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl hover:scale-[1.01] transition border border-slate-100 dark:border-slate-800/50"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className={`font-mono font-bold w-6 text-center ${medalColor}`}>{rankDisplay}</span>
                            <span className="text-lg">{av}</span>
                            <div className="text-left min-w-0">
                              <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{item.name}</p>
                              <p className="text-[9px] text-slate-400">Kelas {item.className} • {item.levelsCompleted}/7 Pos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{item.score} XP</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-850 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-center space-x-1">
                    <Database className="w-3 h-3 text-emerald-500" />
                    <span>Simpah Nilai Secara Real-Time</span>
                  </p>
                </div>
              </div>

            </div>

            {/* CURRICULUM SYLLABUS SECTION */}
            <div className="text-center py-10 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs uppercase tracking-widest font-black text-indigo-500 mb-2">Kurikulum Pendidikan Matematika SMP</h4>
              <p className="text-lg font-extrabold max-w-xl mx-auto mb-8">Pilihlah salah satu dari materi pembelajaran esensial yang kami sediakan untuk petualangan ini</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: "Relasi & Fungsi", items: ["Diagram panah & kartesius", "Menemukan domain / kodomain", "Pemetaan relasi terstruktur"], bg: "from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/40" },
                  { title: "Gradien & Kemiringan", items: ["Gradien garis lewat dua titik", "Persamaan m dari f(x)", "Hubungan sejajar & tegak lurus"], bg: "from-amber-500/10 to-orange-500/5 hover:border-amber-500/40" },
                  { title: "Persamaan Garis Lurus", items: ["Formulasi gradien & satu titik", "Pencarian titik potong sumbu", "Linearisasi grafik dua kutub"], bg: "from-red-500/10 to-rose-500/5 hover:border-red-500/40" },
                  { title: "Statistika Terapan", items: ["Hitung Mean rata-rata", "Mencari Median nilai tengah", "Mengamati Modus tabel frekuensi"], bg: "from-indigo-500/10 to-purple-500/5 hover:border-indigo-500/40" },
                  { title: "Analisis Data (HOTS)", items: ["Jangkauan data (Range)", "Batas Kuartil bawah & Q3", "Menelaah bias data ekstrim"], bg: "from-violet-500/10 to-pink-500/5 hover:border-violet-500/40" },
                  { title: "Kombinasi Akhir", items: ["Materi integratif & numerasi", "Tantangan HOTS logika", "Final Boss Math-Gorath"], bg: "from-teal-500/10 to-cyan-500/5 hover:border-teal-500/40" },
                ].map((syl, i) => (
                  <div key={i} className={`p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br ${syl.bg} transition text-left`}>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2.5 flex items-center justify-between">
                      <span>{syl.title}</span>
                      <span className="text-[10px] uppercase font-semibold text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full">Alur {i+1}</span>
                    </p>
                    <ul className="space-y-1">
                      {syl.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* MAP OVERVIEW SCREEN */}
        {player && currentScreen === "map" && (
          <div className="animate-fade-in space-y-8">
            
            {/* STAGE & PLAYER STATS HEADBOARD */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-900 p-6 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl border border-teal-500/10">
              
              <div className="flex items-center space-x-4">
                <div className="text-5xl bg-white/10 p-2.5 rounded-2xl animate-pulse">
                  {currentAvatarInfo?.emoji}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Juru Jelajah Aktif</p>
                  <h2 className="text-2xl font-black">{player.name}</h2>
                  <p className="text-xs text-slate-300 mt-1">Kelas <strong className="text-white">{player.className}</strong> • XP Saat Ini: <strong className="text-emerald-400 font-bold">{player.score}</strong> XP</p>
                </div>
              </div>

              {/* Progress Level Visual */}
              <div className="flex-1 max-w-md bg-white/5 p-4 rounded-2xl border border-white/10 text-left">
                <div className="flex justify-between text-xs font-black uppercase mb-1.5 text-teal-300">
                  <span>Progres Lintas Alam</span>
                  <span>{player.unlockedLevels.length} / 7 Pos Terbuka</span>
                </div>
                <div className="w-full bg-slate-900/60 rounded-full h-3 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-300 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(player.unlockedLevels.length / 7) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-300 mt-1.5 italic text-center">Tip: Kalahkan naga Math-Gorath di Candi Pemutus untuk kelulusan!</p>
              </div>

              {/* Badges Earned Counts */}
              <div className="flex flex-row md:flex-col gap-2 items-center md:items-end justify-center">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-300">Medali/Badge</span>
                <div className="flex gap-1.5 bg-slate-900/40 p-1.5 rounded-xl border border-white/5">
                  {player.badges.map((bId) => {
                    const badge = BADGES.find(b => b.id === bId);
                    return (
                      <span 
                        key={bId} 
                        className="text-xl inline-block hover:scale-125 transition cursor-pointer"
                        title={`${badge?.name}: ${badge?.description}`}
                      >
                        {badge?.icon || "🏅"}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* INTERACTIVE WINDING MAP */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl">
              <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-8 flex items-center justify-center space-x-2">
                <Map className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                <span>Peta Rute Ekspedisi Lintas Alam</span>
              </h3>

              {/* THE GRID OF MAP LEVELS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                {GAME_LEVELS.map((level, index) => {
                  const isUnlocked = player.unlockedLevels.includes(level.id);
                  const isCompleted = player.currentLevel > level.id;
                  const isActive = player.currentLevel === level.id;

                  // Assign styles based on environment/themeColor
                  let envBadgeColor = "bg-slate-100 text-slate-500";
                  let cardHoverColor = "hover:border-slate-300";
                  if (isUnlocked) {
                    if (level.themeColor === "emerald") {
                      envBadgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                      cardHoverColor = "hover:border-emerald-500 hover:shadow-emerald-500/5";
                    } else if (level.themeColor === "sky") {
                      envBadgeColor = "bg-sky-500/10 text-sky-600 dark:text-sky-400";
                      cardHoverColor = "hover:border-sky-500 hover:shadow-sky-500/5";
                    } else if (level.themeColor === "amber") {
                      envBadgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
                      cardHoverColor = "hover:border-amber-500 hover:shadow-amber-500/5";
                    } else if (level.themeColor === "red") {
                      envBadgeColor = "bg-red-500/10 text-red-600 dark:text-red-400";
                      cardHoverColor = "hover:border-red-500 hover:shadow-red-500/5";
                    } else if (level.themeColor === "indigo") {
                      envBadgeColor = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
                      cardHoverColor = "hover:border-indigo-500 hover:shadow-indigo-500/5";
                    } else if (level.themeColor === "purple") {
                      envBadgeColor = "bg-purple-500/10 text-purple-600 dark:text-purple-400";
                      cardHoverColor = "hover:border-purple-500 hover:shadow-purple-500/5";
                    } else {
                      envBadgeColor = "bg-violet-500/10 text-violet-600 dark:text-violet-400";
                      cardHoverColor = "hover:border-violet-500 hover:shadow-violet-500/5";
                    }
                  }

                  return (
                    <div 
                      key={level.id}
                      onClick={() => handleSelectLevel(level)}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl border transition duration-300 cursor-pointer text-left ${isUnlocked ? `bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 ${cardHoverColor}` : "bg-slate-100 dark:bg-slate-950 opacity-40 border-slate-200 dark:border-slate-900 cursor-not-allowed"} ${isActive ? "ring-2 ring-emerald-500 ring-offset-4 ring-offset-white dark:ring-offset-slate-900 scale-[1.02]" : ""}`}
                    >
                      {/* Badge / Level Index Label */}
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[10px] tracking-widest font-black uppercase px-2.5 py-0.5 rounded-full ${envBadgeColor}`}>
                          Pos {level.id}
                        </span>
                        
                        <div>
                          {isCompleted ? (
                            <span className="text-emerald-500 font-bold text-xs flex items-center space-x-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Selesai</span>
                            </span>
                          ) : isUnlocked ? (
                            <span className="text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center space-x-1">
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Buka</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-bold text-xs flex items-center space-x-1">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Terkunci</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Title */}
                      <div className="mb-4">
                        <h4 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                          {level.name.split(":")[1]?.trim() || level.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-red-500" />
                          <span>{level.environment}</span>
                        </p>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 md:line-clamp-3 mb-4">
                        {level.description}
                      </p>

                      <div className="pt-3 border-t border-slate-150 dark:border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Total: {level.questions.length} Tantangan</span>
                        {isUnlocked && (
                          <span className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        )}
                      </div>

                      {/* Sparkle for Current Active */}
                      {isActive && (
                        <span className="absolute -top-2 -right-2 bg-rose-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce shadow">
                          Tujuanmu
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ALL BADGES LIST */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl text-left">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Papan Penghargaan (Badges Shelf)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {BADGES.map((b) => {
                  const hasEarned = player.badges.includes(b.id);
                  return (
                    <div 
                      key={b.id} 
                      className={`p-4 rounded-2xl border transition duration-150 flex flex-col items-center text-center ${hasEarned ? "bg-slate-50 dark:bg-slate-950/20 border-teal-500/20 shadow-md" : "bg-slate-100 dark:bg-slate-950 opacity-30 border-dashed border-slate-300 dark:border-slate-850"}`}
                    >
                      <span className="text-4xl mb-2.5 inline-block">{b.icon}</span>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-3">{b.name}</p>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{b.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ACTIVE GAMEPLAY SCREEN */}
        {player && currentScreen === "play" && activeLevel && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* HERO LEVEL NARRATIVE BACKGROUND ILLUSTRATION (LEFT COLUMN) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* LEVEL STORY & ENVIRONMENT PANEL */}
              <div className={`rounded-3xl p-6 text-white bg-gradient-to-br ${activeLevel.bgGradient} border border-white/5 relative overflow-hidden shadow-2xl`}>
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Compass className="w-32 h-32" />
                </div>

                <div className="relative z-10 text-left">
                  <div className="flex justify-between items-center mb-4 text-xs font-bold uppercase tracking-wider text-teal-300">
                    <span>Pos {activeLevel.id} • {activeLevel.environment}</span>
                    <span>Tantangan {currentQuestionIndex + 1} / {activeLevel.questions.length}</span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-black mb-3">
                    {activeLevel.name}
                  </h3>

                  <p className="text-slate-200 text-sm leading-relaxed italic border-l-2 border-emerald-400 pl-3 py-1 bg-white/5 rounded-r-xl mb-4">
                    "{activeLevel.questions[currentQuestionIndex].storySegment}"
                  </p>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {currentQuestionIndex === 0 ? activeLevel.storyIntro : "Jangan hentikan langkahmu! Selubung kegelapan mulai menghilang seiring barisan sandi yang kamu selesaikan denga logikamu."}
                  </p>

                  {/* Level Theme Illustration rendering using static custom CSS style SVGs */}
                  <div className="mt-6 w-full h-44 rounded-2xl bg-slate-950/40 p-4 border border-white/10 flex items-center justify-center relative">
                    
                    {/* Hutan illustration */}
                    {activeLevel.environment === "Hutan" && (
                      <div className="flex items-end justify-center space-x-4 h-full w-full pb-2">
                        <span className="text-5xl animate-bounce">🌳</span>
                        <span className="text-3xl opacity-80">🌲</span>
                        <span className="text-6xl animate-pulse">🌳</span>
                        <span className="text-3xl opacity-60">🏕️</span>
                      </div>
                    )}

                    {/* Sungai illustration */}
                    {activeLevel.environment === "Sungai" && (
                      <div className="flex flex-col items-center justify-center h-full w-full relative">
                        <div className="text-5xl animate-bounce">🌊</div>
                        <div className="absolute bottom-2 left-6 text-3xl">🪨</div>
                        <div className="absolute bottom-2 right-6 text-3xl">🪨</div>
                        <div className="absolute top-4 right-12 text-2xl">🛶</div>
                      </div>
                    )}

                    {/* Tebing illustration */}
                    {activeLevel.environment === "Tebing" && (
                      <div className="flex items-center justify-center h-full w-full relative">
                        <div className="text-6xl absolute left-8">🧗</div>
                        <div className="text-4xl absolute right-12 transform rotate-12">⛰️</div>
                        <div className="text-5xl absolute">🪘</div>
                      </div>
                    )}

                    {/* Jembatan illustration */}
                    {activeLevel.environment === "Jembatan" && (
                      <div className="flex flex-col items-center justify-center h-full w-full">
                        <div className="text-6xl animate-bounce">🌉</div>
                        <div className="text-xs text-red-400 uppercase tracking-widest font-bold mt-2">Ngarai Lava Menyala 🔥</div>
                      </div>
                    )}

                    {/* Desa illustration */}
                    {activeLevel.environment === "Desa" && (
                      <div className="flex items-end justify-center space-x-6 h-full w-full pb-2">
                        <span className="text-5xl animate-pulse">🏡</span>
                        <span className="text-4xl">🌾</span>
                        <span className="text-5xl">🐄</span>
                      </div>
                    )}

                    {/* Gua illustration */}
                    {activeLevel.environment === "Gua" && (
                      <div className="flex items-center justify-center h-full w-full space-x-3">
                        <span className="text-5xl animate-spin-slow">💎</span>
                        <span className="text-4xl">🔦</span>
                        <span className="text-5xl opacity-40">🦇</span>
                      </div>
                    )}

                    {/* Candi (Boss) illustration */}
                    {activeLevel.environment === "Candi" && (
                      <div className="w-full h-full relative flex flex-col justify-center items-center">
                        {/* Shaking boss head */}
                        <div className={`text-6xl transition duration-150 ${isBossAttacking ? "scale-125 translate-y-3" : ""} ${isPlayerHurt ? "animate-pulse" : "animate-bounce"}`}>
                          🐉
                        </div>
                        <div className="w-full mt-3 bg-red-600/30 rounded-full h-2 p-0.5">
                          <div className="bg-red-500 h-1 rounded-full transition-all duration-300" style={{ width: `${bossHp}%` }}></div>
                        </div>
                        <div className="flex justify-between w-full mt-1 px-1 text-[9px] uppercase tracking-wider font-extrabold">
                          <span className="text-red-400">MATH-GORATH HP</span>
                          <span className="text-white">{bossHp}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* RETAKE / BACK NAVIGATION ACTION KEYS */}
              <div className="flex gap-3 justify-start">
                <button
                  id="go-back-map-btn"
                  onClick={() => { if (audioEnabled) playClick(); setCurrentScreen("map"); setActiveLevel(null); }}
                  className="px-5 py-3 text-xs font-bold rounded-xl border border-slate-350 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition flex items-center space-x-1"
                >
                  <Map className="w-4 h-4" />
                  <span>Keluar ke Peta</span>
                </button>
                <button
                  id="retake-question-btn"
                  onClick={handleRetakeLevel}
                  className="px-5 py-3 text-xs font-bold rounded-xl border border-slate-350 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition flex items-center space-x-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ulangi Pos Ini</span>
                </button>
              </div>
            </div>

            {/* GAMEPLAY CONTENT CARD (RIGHT COLUMN) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl text-left flex flex-col justify-between">
              
              {/* TOP STATUS ROW */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80 mb-6">
                  
                  {/* Energy Hearts */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Energi:</span>
                    <div className="flex space-x-1" id="player-lives-container">
                      {[1, 2, 3].map((heartIdx) => (
                        <Heart 
                          key={heartIdx} 
                          className={`w-5 h-5 ${player.lives >= heartIdx ? "text-rose-500 fill-rose-500 animate-pulse" : "text-slate-350 dark:text-slate-800"}`} 
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center space-x-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <Timer className={`w-4 h-4 text-amber-500 ${questionTimer < 30 ? "animate-spin-slow text-red-500" : ""}`} />
                    <span className={`text-xs font-mono font-black ${questionTimer < 30 ? "text-red-500" : "text-amber-500"}`}>
                      {Math.floor(questionTimer / 60)}:{String(questionTimer % 60).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="text-teal-600 dark:text-teal-400 font-bold text-sm">
                    SKOR: <span className="text-base font-black text-slate-800 dark:text-white">{player.score}</span> XP
                  </div>

                </div>

                {/* DYNAMIC TOPIC & DECRIPTION */}
                <div className="mb-4">
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                    Topik: {activeLevel.questions[currentQuestionIndex].topic}
                  </span>
                  <span className={`ml-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${activeLevel.questions[currentQuestionIndex].difficulty === "HOTS" ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"}`}>
                    Kelas {activeLevel.questions[currentQuestionIndex].difficulty}
                  </span>
                </div>

                {/* QUESTION WRITING MARKDOWN COMPATIBLE */}
                <div id="question-prompt-text" className="text-base font-extrabold leading-relaxed text-slate-800 dark:text-slate-100 mb-6">
                  {activeLevel.questions[currentQuestionIndex].prompt}
                </div>

                {/* OPTIONAL GRAPHICAL COMPONENT OR SVG RENDER */}
                {activeLevel.questions[currentQuestionIndex].visual && (
                  <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 flex justify-center">
                    
                    {/* 1. Diagram Panah Rendering */}
                    {activeLevel.questions[currentQuestionIndex].visual?.type === "diagram_panah" && activeLevel.questions[currentQuestionIndex].visual?.arrowDiagram && (
                      <div className="flex justify-between items-center w-full max-w-sm py-4">
                        <div className="flex flex-col space-y-4 text-center">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">A (Domain)</span>
                          {activeLevel.questions[currentQuestionIndex].visual?.arrowDiagram?.domain.map(dom => (
                            <div key={dom.id} className="w-10 h-10 rounded-full border border-indigo-500 flex items-center justify-center font-bold text-sm bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
                              {dom.label}
                            </div>
                          ))}
                        </div>

                        {/* Arrows placeholder */}
                        <div className="flex-1 relative mx-4 h-40 flex flex-col justify-around">
                          <svg className="w-full h-full text-indigo-500 opacity-60 absolute inset-0" fill="none" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                              </marker>
                            </defs>
                            {/* Lines from Domain to Kodomain depending on relations mapping */}
                            {activeLevel.questions[currentQuestionIndex].visual?.arrowDiagram?.relations.map((rel, index) => {
                              // Rough vertical offset logic for arrows
                              const fromY = rel.from === "1" ? "18" : rel.from === "2" ? "50" : "82";
                              const toY = rel.to === "a" ? "15" : rel.to === "b" ? "38" : rel.to === "c" ? "61" : "85";
                              return (
                                <line 
                                  key={index}
                                  x1="5" 
                                  y1={`${fromY}%`} 
                                  x2="92" 
                                  y2={`${toY}%`} 
                                  stroke="currentColor" 
                                  strokeWidth="2" 
                                  markerEnd="url(#arrow)" 
                                />
                              );
                            })}
                          </svg>
                        </div>

                        <div className="flex flex-col space-y-3 text-center">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">B (Kodomain)</span>
                          {activeLevel.questions[currentQuestionIndex].visual?.arrowDiagram?.kodomain.map(kod => (
                            <div key={kod.id} className="w-8 h-8 rounded-full border border-slate-350 dark:border-slate-800 flex items-center justify-center font-bold text-xs bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                              {kod.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Grafik Kartesius Grid Click & View Rendering */}
                    {activeLevel.questions[currentQuestionIndex].visual?.type === "grafik_kartesius" && (
                      <div className="flex flex-col items-center w-full max-w-sm py-4">
                        <div id="cartesian-grid-desc" className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2 text-center">
                          Koordinat Kartesius SMP Petualang (10x10)
                        </div>
                        
                        <div className="relative border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 rounded-xl shadow-inner">
                          
                          {/* Inner Coordinate Graph representation using SVG Grid click mapping */}
                          <svg width="260" height="260" className="text-slate-350 dark:text-slate-800">
                            {/* Grid lines */}
                            {gridLines.map((gl) => {
                              const pos = 130 + gl * 22;
                              return (
                                <React.Fragment key={gl}>
                                  {/* vertical lines */}
                                  <line x1={pos} y1="10" x2={pos} y2="250" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3" />
                                  {/* horizontal lines */}
                                  <line x1="10" y1={pos} x2="250" y2={pos} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3" />
                                  {/* labels */}
                                  <text x={pos} y="138" fontSize="8" className="fill-slate-400 font-mono" textAnchor="middle">{gl !== 0 ? gl : ""}</text>
                                  <text x="122" y={pos + 3} fontSize="8" className="fill-slate-400 font-mono" textAnchor="middle">{gl !== 0 ? -gl : ""}</text>
                                </React.Fragment>
                              );
                            })}
                            
                            {/* Axes */}
                            <line x1="130" y1="5" x2="130" y2="255" stroke="#10b981" strokeWidth="2" /> {/* Y-Axis */}
                            <line x1="5" y1="130" x2="255" y2="130" stroke="#10b981" strokeWidth="2" /> {/* X-Axis */}

                            {/* Arrow pointers for line equations if supplied */}
                            {activeLevel.questions[currentQuestionIndex].visual?.cartesiusGraph?.lineEquation && (
                              <line 
                                x1={130 + (-3) * 22} 
                                y1={130 - ((-3) * (-3) + 6) * 22} 
                                x2={130 + (3) * 22} 
                                y2={130 - ((3) * (-3) + 6) * 22} 
                                stroke="#ef4444" 
                                strokeWidth="3" 
                              />
                            )}

                            {/* Clickable Overlay Grid points (only active on KOORDINAT_PUZZLE) */}
                            {activeLevel.questions[currentQuestionIndex].type === "KOORDINAT_PUZZLE" && (
                              gridLines.map((xVal) => (
                                gridLines.map((yVal) => {
                                  const renderX = 130 + xVal * 22;
                                  // SVG Coordinates are top-left relative, so we invert Y axis
                                  const renderY = 130 - yVal * 22;
                                  const isActiveSelected = clickedCoordinate?.x === xVal && clickedCoordinate?.y === yVal;
                                  return (
                                    <circle
                                      id={`grid-point-${xVal}-${yVal}`}
                                      key={`${xVal},${yVal}`}
                                      cx={renderX}
                                      cy={renderY}
                                      r={isActiveSelected ? "6" : "3.5"}
                                      className={`cursor-pointer transition duration-150 ${isActiveSelected ? "fill-teal-500 scale-125 stroke-white stroke-2" : "fill-slate-400 hover:fill-amber-500 opacity-60"}`}
                                      onClick={() => handleCartesianGridClick(xVal, yVal)}
                                    />
                                  );
                                })
                              ))
                            )}

                            {/* Target points display after answered */}
                            {isAnswered && activeLevel.questions[currentQuestionIndex].visual?.cartesiusGraph?.targetPoint && (
                              <circle 
                                cx={130 + (activeLevel.questions[currentQuestionIndex].visual?.cartesiusGraph?.targetPoint?.x || 0) * 22}
                                cy={130 - (activeLevel.questions[currentQuestionIndex].visual?.cartesiusGraph?.targetPoint?.y || 0) * 22}
                                r="8"
                                className="fill-none stroke-emerald-500 stroke-4 animate-ping"
                              />
                            )}
                          </svg>

                          {/* Guide hint */}
                          <div className="text-[10px] text-slate-400 mt-2 text-center text-rose-500 font-extrabold italic">
                            {clickedCoordinate ? `Titik yang dipilih: (${clickedCoordinate.x}, ${clickedCoordinate.y})` : "Tekan bulatan di dalam grid untuk memecahkan sandi!"}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* 3. Frek Table View */}
                    {activeLevel.questions[currentQuestionIndex].visual?.type === "freq_table" && activeLevel.questions[currentQuestionIndex].visual?.freqTable && (
                      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-250 dark:border-slate-800 text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                              {activeLevel.questions[currentQuestionIndex].visual?.freqTable?.headers.map((h, i) => (
                                <th key={i} className="py-2 px-3 text-left font-extrabold text-slate-700 dark:text-slate-350">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeLevel.questions[currentQuestionIndex].visual?.freqTable?.rows.map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-900 last:border-0 hover:bg-slate-100/50">
                                <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{row[0]}</td>
                                <td className="py-2 px-3 text-emerald-500 font-bold">{row[1]} kebun</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 4. Kuartil Boxplot Illustration */}
                    {activeLevel.questions[currentQuestionIndex].visual?.type === "kuartil_box" && activeLevel.questions[currentQuestionIndex].visual?.boxplot && (
                      <div className="w-full max-w-sm py-4 flex flex-col items-center">
                        <p className="text-[10px] text-slate-400 font-black mb-3">DIAGRAM KOTAK GARIS (BOXPLOT) KANDUNGAN EMAS</p>
                        <div className="relative w-full h-16 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center p-2">
                          <svg className="w-full h-full" viewBox="0 0 100 30">
                            {/* Base Line */}
                            <line x1="10" y1="15" x2="90" y2="15" stroke="#94a3b8" strokeWidth="1" />
                            {/* Whiskers */}
                            <line x1="10" y1="10" x2="10" y2="20" stroke="#ef4444" strokeWidth="1" />
                            <line x1="90" y1="10" x2="90" y2="20" stroke="#ef4444" strokeWidth="1" />
                            {/* Box */}
                            <rect x="30" y="7" width="40" height="16" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
                            {/* Median line inside rect */}
                            <line x1="50" y1="7" x2="50" y2="23" stroke="#eab308" strokeWidth="2" />
                            
                            {/* Labels in percentage relative */}
                            <text x="10" y="28" fontSize="4" textAnchor="middle" className="fill-slate-400">Min: 5</text>
                            <text x="30" y="28" fontSize="4" textAnchor="middle" className="fill-slate-400">Q1: 15</text>
                            <text x="50" y="5" fontSize="4" textAnchor="middle" className="fill-slate-400">Q2 (Med): 25</text>
                            <text x="70" y="28" fontSize="4" textAnchor="middle" className="fill-slate-400">Q3: 35</text>
                            <text x="90" y="28" fontSize="4" textAnchor="middle" className="fill-slate-400">Maks: 50</text>
                          </svg>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* --- ANSWERS INPUT BUILDER BY QUESTION TYPE --- */}

                {/* TYPE A: PILIHAN GANDA */}
                {(activeLevel.questions[currentQuestionIndex].type === "PILIHAN_GANDA" || activeLevel.questions[currentQuestionIndex].type === "BENAR_SALAH") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {activeLevel.questions[currentQuestionIndex].options?.map((opt) => {
                      const isSelected = selectedOption === opt;
                      return (
                        <button
                          key={opt}
                          id={`option-btn-${opt.split(".")[0] || opt}`}
                          disabled={isAnswered}
                          onClick={() => { if (audioEnabled) playClick(); setSelectedOption(opt); }}
                          className={`p-4 rounded-2xl border text-left text-xs md:text-sm font-bold transition duration-200 flex items-center justify-between ${
                            isSelected 
                              ? "bg-emerald-500/10 border-emerald-500 scale-[1.01] shadow-md text-emerald-600 dark:text-emerald-400" 
                              : "bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100"
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TYPE B: ISIAN SINGKAT */}
                {activeLevel.questions[currentQuestionIndex].type === "ISIAN_SINGKAT" && (
                  <div className="mb-6 space-y-3">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">
                      Ketik Jawaban Isian Singkatan (Gunakan angka saja apabila numerik atau teks singkat)
                    </label>
                    <input 
                      id="text-answers-input"
                      type="text"
                      disabled={isAnswered}
                      value={shortAnswer}
                      onChange={(e) => setShortAnswer(e.target.value)}
                      placeholder="Masukkan jawabanmu..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-base shadow-inner transition"
                    />
                  </div>
                )}

                {/* TYPE C: DRAG DROP / CLICK TO CLASSIFY (Touch Screen Friendly!) */}
                {activeLevel.questions[currentQuestionIndex].type === "DRAG_DROP" && (
                  <div className="space-y-6 mb-6">
                    <p className="text-xs text-amber-500 font-bold flex items-center">
                      <Sparkles className="w-4 h-4 mr-1" />
                      <span>Alur Klasifikasi: Tekan pilar di bawah untuk mendaftarkan himpunan data</span>
                    </p>

                    {/* Drop Zones Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="drag-drop-zones">
                      {activeLevel.questions[currentQuestionIndex].dropZones?.map(zone => {
                        // Find which items are assigned here
                        const assigned = Object.entries(dragAssignments)
                          .filter(([_, value]) => value === zone.id)
                          .map(([key, _]) => activeLevel.questions[currentQuestionIndex].dragItems?.find(it => it.id === key))
                          .filter(Boolean);

                        return (
                          <div 
                            key={zone.id} 
                            className="bg-slate-50 dark:bg-slate-950/20 border border-indigo-500/10 p-4 rounded-xl min-h-24 flex flex-col justify-between"
                          >
                            <span className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">{zone.label}</span>
                            
                            <div className="space-y-1.5 flex-grow">
                              {assigned.length === 0 ? (
                                <span className="text-[10px] text-slate-450 italic block py-4 text-center">Belum ada item</span>
                              ) : (
                                assigned.map(item => (
                                  <div 
                                    key={item?.id} 
                                    className="p-1 px-2.5 bg-indigo-500/10 hover:bg-rose-500/10 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-lg flex items-center justify-between cursor-pointer"
                                    onClick={() => item && handleRemoveDragDrop(item.id)}
                                    title="Pindahkan kembali"
                                  >
                                    <span>{item?.text}</span>
                                    <XCircle className="w-3 h-3 text-slate-400" />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Available Items to Categorize */}
                    <div>
                      <p className="block text-[11px] uppercase tracking-widest font-black text-slate-400 mb-2">Item Himpunan Tersedia:</p>
                      <div className="flex flex-wrap gap-2">
                        {activeLevel.questions[currentQuestionIndex].dragItems?.map(item => {
                          const isAssigned = Object.keys(dragAssignments).includes(item.id);
                          if (isAssigned) return null; // Hide already categorised

                          return (
                            <div key={item.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col space-y-2">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{item.text}</span>
                              <div className="flex space-x-1 justify-center">
                                {activeLevel.questions[currentQuestionIndex].dropZones?.map(zone => (
                                  <button
                                    id={`assign-btn-${item.id}-${zone.id}`}
                                    key={zone.id}
                                    type="button"
                                    onClick={() => handleAssignDragDrop(item.id, zone.id)}
                                    className="p-1 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-md border border-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 transition"
                                  >
                                    + {zone.label.split(" ")[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TYPE D: MENJODOHKAN (Matching Game with interactive clicks!) */}
                {activeLevel.questions[currentQuestionIndex].type === "MENJODOHKAN" && (
                  <div className="mb-6 space-y-4">
                    <p className="text-xs text-indigo-500 font-bold flex items-center">
                      <Sparkles className="w-4 h-4 mr-1 animate-pulse" />
                      <span>Sandi Garis: Klik satu nama di kiri, kemudian klik solusi di kanan untuk menyambung kabel jembatan!</span>
                    </p>

                    <div className="grid grid-cols-2 gap-8 relative items-center">
                      {/* Left Column values */}
                      <div className="space-y-3">
                        {activeLevel.questions[currentQuestionIndex].matchingLeft?.map(leftText => {
                          const isSelected = selectedMatchingLeft === leftText;
                          const mappedRightVal = matchingPairs[leftText];
                          return (
                            <button
                              id={`match-left-${leftText.replace(/\s+/g, '')}`}
                              disabled={isAnswered}
                              key={leftText}
                              type="button"
                              onClick={() => handleMatchingLeftClick(leftText)}
                              className={`w-full p-3 font-semibold text-xs md:text-sm text-left rounded-xl border transition duration-150 ${
                                isSelected 
                                  ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-md"
                                  : mappedRightVal
                                    ? "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400"
                                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-350"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span>{leftText}</span>
                                {mappedRightVal && <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-1.5 py-0.5 rounded-full">Tersambung</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Column values */}
                      <div className="space-y-3">
                        {activeLevel.questions[currentQuestionIndex].matchingRight?.map(rightText => {
                          // Find if any left references this right
                          const matchedLeft = Object.entries(matchingPairs).find(([_, right]) => right === rightText)?.[0];
                          return (
                            <button
                              id={`match-right-${rightText.replace(/[()\-/\s=,]+/g, '')}`}
                              disabled={isAnswered || !selectedMatchingLeft}
                              key={rightText}
                              type="button"
                              onClick={() => handleMatchingRightClick(rightText)}
                              className={`w-full p-3 font-mono text-left font-bold text-[11px] md:text-xs rounded-xl border transition duration-150 ${
                                matchedLeft 
                                  ? "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400"
                                  : selectedMatchingLeft
                                    ? "bg-amber-500/5 hover:bg-amber-500/20 border-amber-500/20 text-slate-705 dark:text-slate-300"
                                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 text-center"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span>{rightText}</span>
                                {matchedLeft && <span className="text-[9px] text-slate-400 font-bold truncate">({matchedLeft.split(" ")[1]})</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!isAnswered && Object.keys(matchingPairs).length > 0 && (
                      <button
                        id="clear-matching-btn"
                        onClick={handleClearMatchingPairs}
                        className="text-xs text-rose-500 hover:underline font-bold flex items-center space-x-1"
                      >
                        <span>Bersihkan Rantai Garis/Kabel</span>
                      </button>
                    )}
                  </div>
                )}

              </div>

              {/* ACTION COMMAND BAR */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                
                {/* Submit button */}
                {!isAnswered ? (
                  <button
                    id="submit-answer-btn"
                    onClick={handleCheckAnswer}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs md:text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    Periksa Jawaban Sekarang 🛡️
                  </button>
                ) : (
                  <button
                    id="next-question-btn"
                    onClick={handleNextQuestion}
                    className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs md:text-sm transition shadow-lg shadow-teal-500/20 flex items-center space-x-2"
                  >
                    <span>Lanjutkan Perjalanan</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                <div className="text-[10px] text-slate-400 italic">
                  *Kerjakan dengan teliti agar nyawa energi tidak berkurang!
                </div>
              </div>

              {/* AI COMPANION AUTO STUDY (PEMBAHASAN AUTOMATIS WITH GEMINI) */}
              {isAnswered && (
                <div id="ai-explanation-box" className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 animate-fade-in text-left">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-indigo-500 text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow">
                      <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                      <span>Kak Alim AI Pedamping</span>
                    </span>
                    
                    {isLoadingAI && (
                      <span className="text-[10px] text-indigo-500 font-bold flex items-center space-x-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Menganalisis Jawaban...</span>
                      </span>
                    )}
                  </div>

                  <div className={`p-5 rounded-2xl border text-xs leading-relaxed space-y-3 ${isCorrectFeedback ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                    
                    {/* Header Verdict banner */}
                    <div className="flex items-center space-x-2 pb-2.5 border-b border-white/5 font-extrabold mb-3">
                      {isCorrectFeedback ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-emerald-500 text-sm">JAWABAN BENAR! BONUS XP BERHASIL DIPEROLEH</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-500 animate-bounce" />
                          <span className="text-rose-500 text-sm">JAWABAN KURANG TEPAT! TETAP SEMANGAT</span>
                        </>
                      )}
                    </div>

                    {/* AI explanation renderer output */}
                    <div className="prose dark:prose-invert prose-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {aiExplanation || "Sedang memproses evaluasi numerasi..."}
                    </div>

                    {/* Disclaimer */}
                    <div className="pt-3 border-t border-slate-150 dark:border-slate-805 text-[10px] text-slate-450 italic flex items-center justify-between">
                      <span>Ref: Buku Matematika Kemdikbud Kelas VIII</span>
                      <span>Sistem Evaluasi Terintegrasi</span>
                    </div>

                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* END GAME GRADUATION CERTIFICATE SCREEN */}
        {player && currentScreen === "certificate" && (
          <div className="max-w-4xl mx-auto animate-fade-in text-center space-y-8 mt-4">
            
            <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 text-center max-w-lg mx-auto">
              <span className="text-4xl">👑</span>
              <h2 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">TAMAT PETUALANGAN!</h2>
              <p className="text-xs text-slate-400 mt-1">Naga Math-Gorath berhasil kamu taklukkan! Seluruh pos Lintas Alam Matematika SMP telah terbuka dan kamu dinyatakan lulus ujian numerasi luar ruangan.</p>
            </div>

            {/* THE AWESOME PRINTABLE DECORATED CERTIFICATE */}
            <div 
              id="printable-certificate-box"
              className="relative p-8 md:p-14 bg-white text-slate-900 border-8 border-double border-teal-600 rounded-3xl mx-auto shadow-2xl overflow-hidden max-w-3xl text-center"
              style={{ minHeight: "500px" }}
            >
              
              {/* Outer decorative borders and watermarks */}
              <div className="absolute top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, #0f766e 0px, #0f765e 20px, transparent 20px, transparent 40px)" }}></div>
              <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full border-4 border-amber-500/20 opacity-30 flex items-center justify-center">
                <span className="text-amber-500/30 text-5xl font-mono">SMP</span>
              </div>

              {/* Certificate Headings */}
              <div className="relative z-10 space-y-4">
                <p className="text-teal-700 font-mono tracking-widest font-black text-xs uppercase">SERTIFIKAT KELULUSAN AKADEMIK</p>
                
                <h1 className="text-3xl md:text-4xl font-serif font-black tracking-wide text-slate-850">
                  PRADNYA PARAMITA
                </h1>
                
                <div className="w-1/3 h-[2px] bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600 mx-auto"></div>

                <p className="text-xs text-slate-500 max-w-md mx-auto italic">
                  Sertifikat ini dianugerahkan dengan hormat kepada penjelajah luhur yang telah menyelesaikan seluruh tahapan ujian Lintas Alam Matematika di alam terbuka dengan gemilang.
                </p>

                {/* Recipient Details */}
                <div className="py-6 space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#0f766e]">Selamat Kepada:</p>
                  <h3 id="recipient-name" className="text-2xl md:text-3xl font-black text-indigo-950 font-serif border-b border-indigo-950/10 inline-block px-12 pb-1.5">
                    {player.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Kelas: {player.className} • SMP Petualang</p>
                </div>

                {/* Performance stats summary inside certificate */}
                <div className="grid grid-cols-3 gap-2 border border-teal-600/20 bg-teal-500/5 rounded-2xl p-4 max-w-md mx-auto text-left">
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-450 leading-3">Total Skor:</span>
                    <strong className="text-base font-black text-slate-800">{player.score} XP</strong>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-450 leading-3">Misi Selesai:</span>
                    <strong className="text-base font-black text-slate-800">7 / 7 Pos</strong>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-450 leading-3">Predikat:</span>
                    <strong className="text-xs font-black text-amber-500 uppercase">Ahli Numerasi</strong>
                  </div>
                </div>

                <p className="text-[10px] text-slate-450 leading-relaxed max-w-sm mx-auto pt-2">
                  Ditetapkan di Kawasan Konservasi Pendidikan Alam, Jawa Timur pada tanggal <strong className="text-slate-700">{new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</strong>.
                </p>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 pt-8 text-xs max-w-md mx-auto">
                  <div className="text-center font-bold">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Wakil Kurikulum</p>
                    <div className="h-10 border-b border-dashed border-slate-300 w-2/3 mx-auto"></div>
                    <p className="text-slate-800 mt-1">Kak Alim Math AI</p>
                  </div>
                  <div className="text-center font-bold">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Kepala Sekolah SMP</p>
                    <div className="h-10 border-b border-dashed border-slate-300 w-2/3 mx-auto"></div>
                    <p className="text-slate-800 mt-1">Suwarto, S.Pd., M.A.</p>
                  </div>
                </div>

              </div>
            </div>

            {/* BUTTON CONTROLS TO RESTART OR PRINT */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                id="print-certific-btn"
                onClick={() => window.print()}
                className="bg-teal-600 hover:bg-teal-500 text-white font-extrabold px-8 py-3.5 rounded-xl text-xs md:text-sm uppercase tracking-wider shadow-lg flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Cetak / Print Sertifikat</span>
              </button>
              <button
                id="reset-adventure-btn"
                onClick={handleLogOut}
                className="bg-white/10 border border-slate-200 dark:border-slate-800 px-6 py-3.5 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ulangi Seluruh Game</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-teal-500/10 mt-12 py-8 px-4 text-center text-xs text-slate-450 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 Lintas Alam Matematika SMP. Dikembangkan untuk Guru & Siswa SMP Berbasis Game Based Learning.</p>
          <div className="flex space-x-4">
            <span className="hover:underline cursor-pointer" onClick={showGoogleSheetsAlert}>Instruksi Integrasi Data</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer" onClick={() => player ? setCurrentScreen("map") : setCurrentScreen("welcome")}>Daftar Pos</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
