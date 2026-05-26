/**
 * LINTAS ALAM MATEMATIKA SMP — GOOGLE APPS SCRIPT DATABASE INTEGRATION
 * 
 * Petunjuk Penggunaan:
 * 1. Buka Google Sheet Anda: https://docs.google.com/spreadsheets/d/1KxqGtJxbpGPUy-hXfbXZnYkZ2gjjWCRN8cPNHrPFCgo/edit?gid=0#gid=0
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus semua kode default di dalam editor gscript, lalu salin seluruh kode di bawah ini.
 * 4. Simpan proyek dengan menekan ikon Disket / Ctrl+S (Beri nama misalnya: "DB Lintas Alam Matematika").
 * 5. Klik tombol "Terapkan" (Deploy) > "Penerapan Baru" (New Deployment).
 * 6. Pilih jenis penerapan: "Aplikasi Web" (Web App).
 * 7. Konfigurasikan:
 *    - Deskripsi: Integrasi Game Lintas Alam Matematika SMP
 *    - Jalankan sebagai (Execute as): "Saya" (Me / Akun Guru Anda)
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone) -> SANGAT PENTING agar game bisa mengirim data tanpa login akun Google.
 * 8. Klik "Terapkan" (Deploy). Berikan izin akun jika diminta (klik Advanced > Go to Untitled Project (unsafe)).
 * 9. Salin URL Aplikasi Web yang diberikan (Web App URL) dan tempelkan ke konfigurasi game Anda.
 */

// Menangani permintaan POST (Pengiriman nilai dari game ke Google Sheet)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Tunggu hingga 30 detik untuk mengunci proses agar tidak tumpang tindih data jika banyak siswa mengirim bersamaan
    if (!lock.tryLock(30000)) {
       return ContentService.createTextOutput(JSON.stringify({
         "result": "error",
         "error": "Sistem sedang sibuk. Silakan coba kirim kembali dalam beberapa saat."
       })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Mengambil data JSON dari tubuh request
    var postData = JSON.parse(e.postData.contents);
    
    // Koneksi ke Spreadsheet aktif
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Periksa apakah Baris Header sudah ada, jika belum, buat otomatis
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Waktu Selesai (WIB)", 
        "Nama Siswa", 
        "Kelas", 
        "Avatar", 
        "Skor Akhir (XP)", 
        "Pos Terselesaikan"
      ]);
      // Format Header agar tebal dan berlatar hijau estetik
      sheet.getRange(1, 1, 1, 6)
           .setFontWeight("bold")
           .setBackground("#10b981")
           .setFontColor("#white")
           .setHorizontalAlignment("center");
    }
    
    // Ubah waktu UTC menjadi zona waktu lokal WIB/WITA dll.
    var dateLocal = Utilities.formatDate(new Date(postData.completedAt || new Date()), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    
    // Tambahkan data baris baru
    sheet.appendRow([
      dateLocal,
      postData.name,
      postData.className,
      postData.avatar,
      Number(postData.score) || 0,
      Number(postData.levelsCompleted) || 0
    ]);
    
    // Rapikan lebar kolom secara otomatis
    sheet.autoResizeColumns(1, 6);
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success",
      "message": "Skor berhasil dicatat di Google Sheets!",
      "data": postData
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error",
      "error": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

// Menangani permintaan GET (Membaca daftar skor untuk ditampilkan kembali di Leaderboard game)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    
    // Jika tidak ada data, kembalikan array kosong
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    
    var range = sheet.getRange(2, 1, lastRow - 1, 6);
    var values = range.getValues();
    var scoresList = [];
    
    for (var i = 0; i < values.length; i++) {
      scoresList.push({
        id: "sheet_" + i,
        completedAt: values[i][0],
        name: values[i][1],
        className: values[i][2],
        avatar: values[i][3],
        score: parseInt(values[i][4]) || 0,
        levelsCompleted: parseInt(values[i][5]) || 0
      });
    }
    
    // Urutkan berdasarkan skor tertinggi secara dinamis sebelum dikirim ke game
    scoresList.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.levelsCompleted - a.levelsCompleted;
    });
    
    return ContentService.createTextOutput(JSON.stringify(scoresList)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error",
      "error": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
