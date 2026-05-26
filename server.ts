import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load environment variables (dotenv is installed)
import "dotenv/config";

const app = express();
const PORT = 3000;
const SCORES_FILE = path.join(process.cwd(), "scores.json");

app.use(express.json());

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!ai && process.env.GEMINI_API_KEY) {
    try {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.error("Gagal menginisialisasi Gemini API client:", e);
    }
  }
  return ai;
}

// Ensure scores.json exists with initial empty array
async function initDatabase() {
  try {
    await fs.access(SCORES_FILE);
  } catch {
    await fs.writeFile(SCORES_FILE, JSON.stringify([], null, 2));
  }
}

// API Routes

// 1. Get Top Scores (Leaderboard)
app.get("/api/scores", async (req, res) => {
  try {
    await initDatabase();
    const localData = await fs.readFile(SCORES_FILE, "utf-8");
    const localScores = JSON.parse(localData);

    const sheetsUrl = process.env.GOOGLE_SHEETS_URL || "https://script.google.com/macros/s/AKfycbyXV1BsqrB1D3KuWGJMl_tO3bCNl0IFqikCDWgJHdZNhTxl0X4DLmzgsWBm5J9SSwQo/exec";
    if (sheetsUrl) {
      try {
        // Mengambil data dari Google Sheets dengan batas waktu 4 detik agar tidak memperlambat game
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(sheetsUrl, {
          method: "GET",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const liveScores = await response.json();
          if (Array.isArray(liveScores)) {
            // Urutkan dan kirim data Google Sheet langsung yang up to date
            return res.json(liveScores.slice(0, 50));
          }
        }
      } catch (sheetErr) {
        console.warn("Gagal mengambil skor dari Google Sheets. Menggunakan cadangan lokal:", sheetErr);
      }
    }
    
    // Urutkan data lokal (Fallback)
    const sorted = localScores.sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.levelsCompleted !== a.levelsCompleted) return b.levelsCompleted - a.levelsCompleted;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

    res.json(sorted.slice(0, 50)); // Return top 50
  } catch (error) {
    console.error("Gagal membaca skor:", error);
    res.status(500).json({ error: "Gagal memproses data leaderboard" });
  }
});

// 2. Submit Score
app.post("/api/scores", async (req, res) => {
  try {
    const { name, className, avatar, score, levelsCompleted, completedAt } = req.body;
    
    if (!name || !className) {
      return res.status(400).json({ error: "Nama dan Kelas harus diisi" });
    }

    await initDatabase();
    const data = await fs.readFile(SCORES_FILE, "utf-8");
    const scores = JSON.parse(data);

    const newScore = {
      id: Date.now().toString(),
      name,
      className,
      avatar: avatar || "petualang1",
      score: Number(score) || 0,
      levelsCompleted: Number(levelsCompleted) || 0,
      completedAt: completedAt || new Date().toISOString()
    };

    scores.push(newScore);
    await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2));

    // Kirim otomatis ke Google Sheets jika URL dikonfigurasi
    const sheetsUrl = process.env.GOOGLE_SHEETS_URL || "https://script.google.com/macros/s/AKfycbyXV1BsqrB1D3KuWGJMl_tO3bCNl0IFqikCDWgJHdZNhTxl0X4DLmzgsWBm5J9SSwQo/exec";
    if (sheetsUrl) {
      try {
        fetch(sheetsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(newScore)
        }).then(resSheet => {
          if (!resSheet.ok) {
            console.error("Google Sheets Web App mengembalikan error HTTP:", resSheet.status);
          }
        }).catch(err => {
          console.error("Gagal mengirim data skor ke Google Sheets:", err);
        });
      } catch (e) {
        console.error("Gagal menginisialisasi fetch ke Google Sheets:", e);
      }
    }

    res.status(201).json({ message: "Skor berhasil disimpan!", score: newScore });
  } catch (error) {
    console.error("Gagal menyimpan skor:", error);
    res.status(500).json({ error: "Gagal menyimpan skor" });
  }
});

// 3. AI Math Explanations (Pembahasan Misi) using Gemini
app.post("/api/explain", async (req, res) => {
  try {
    const { question, options, correctAnswer, selectedAnswer, topic, customHint } = req.body;

    const gemini = getGeminiClient();
    if (!gemini) {
      return res.json({ 
        explanation: "### Pembahasan Offline\n" + 
                     "Kunci Jawaban yang Benar: **" + correctAnswer + "**\n\n" +
                     "*(Catatan: Layanan AI pendamping sedang offline atau kunci API belum dikonfigurasi. Silakan periksa kembali jawabanmu berdasarkan materi pelajaran.)*"
      });
    }

    const prompt = `
Anda adalah "Kak Alim", seorang mentor petualang matematika SMP yang ramah, seru, dan suportif. 
Tolong jelaskan secara ringkas, jelas, dan interaktif mengenai topik matematika berikut:

Topik: ${topic}
Pertanyaan: ${question}
Opsi Jawaban: ${JSON.stringify(options)}
Jawaban yang Benar: ${correctAnswer}
Jawaban Siswa: ${selectedAnswer || 'Belum Dijawab (Meminta petunjuk)'}
${customHint ? `Petunjuk Tambahan: ${customHint}` : ''}

Buat penjelasan yang:
1. Mulai dengan kalimat penyemangat dan apresiasi (gunakan bahasa Indonesia yang luwes dan ramah ala mentor remaja SMP).
2. Tunjukkan langkah demi langkah solusinya dengan santai namun detail menggunakan notasi matematika yang mudah dimengerti.
3. Sebutkan konsep dasar di balik topik ini (seperti definisi gradien, rumus fungsi, mean/median, dll).
4. Selesaikan dengan nasihat singkat agar terus belajar dan terus berpetualang!
5. Gunakan format Markdown modern. Maksimal 3 paragraf ringkas agar siswa tidak bosan membaca saat bermain game di HP/laptop.
`;

    const response = await gemini.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    res.json({ explanation: response.text });
  } catch (error) {
    console.error("Gagal memanggil Gemini API:", error);
    res.json({ 
      explanation: "### Pembahasan Alternatif\n" + 
                   "Kunci Jawaban yang Benar: **" + (req.body.correctAnswer || "Tertera di atas") + "**\n\n" +
                   "*(Gagal menghubungi server AI. Tetap semangat, pelajari kembali langkah-langkah di sekolah!)*"
    });
  }
});

// Vite server integration in develop mode
async function start() {
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

start();
