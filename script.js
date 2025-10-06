// script.js - Final Revised Version for generate-instrumental (with Android & Metadata Fixes)
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental script loaded. DOM content is ready.');
    
    // --- KONFIGURASI PENTING ---
    // GANTI INI DENGAN URL BACKEND FLASK ANDA JIKA BERBEDA DARI LOKAL!
    // Contoh jika backend di localhost:5000:
    // const API_BASE_URL = 'http://127.0.0.1:5000';
    // Contoh jika Anda menggunakan Pinggy atau layanan tunneling lain:
    const API_BASE_URL = 'https://dindwwctyp.a.pinggy.link'; // REVISI: Ganti dengan URL Pinggy Anda (pastikan ini adalah URL backend, bukan frontend GitHub Pages)
    
    // --- DOM Elements ---
    // Pastikan semua ID ini ada di index.html Anda
    const textInput = document.getElementById('textInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoInput = document.getElementById('tempoInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadBtn = document.getElementById('downloadBtn');
    const wavesurferContainer = document.getElementById('waveform');
    const statusMsg = document.getElementById('statusMsg');
    const charCountDisplay = document.getElementById('charCountDisplay');
    const audioSection = document.getElementById('audioSection');
    
    // Elemen untuk menampilkan metadata (pastikan ID ini ada di index.html)
    const genreDisplay = document.getElementById('genreDisplay');
    const tempoDisplay = document.getElementById('tempoDisplay');
    const durationDisplay = document.getElementById('durationDisplay');
    const lyricsWordCountDisplay = document.getElementById('lyricsWordCountDisplay');
    const lyricsSyllableCountDisplay = document.getElementById('lyricsSyllableCountDisplay');
    
    // --- State ---
    let wavesurferInstance = null;
    let currentAudioUrl = null;
    let currentDownloadUrl = null;
    let isGenerating = false;
    let audioContext = null; // AudioContext diinisialisasi sekali
    
    // --- AudioContext Handling ---
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('✅ AudioContext initialized.');
            } catch (error) {
                console.warn('⚠️ AudioContext not supported or failed to initialize:', error);
            }
        }
        return audioContext;
    }
    
    function resumeAudioContext() {
        if (audioContext && audioContext.state === 'suspended') {
            console.log('Attempting to resume AudioContext...');
            audioContext.resume().then(() => {
                console.log('✅ AudioContext resumed successfully.');
            }).catch(err => {
                console.warn('⚠️ Failed to resume AudioContext:', err);
            });
        } else if (audioContext && audioContext.state === 'running') {
            // console.log('AudioContext is already running.');
        }
    }
    
    // PENTING: Gunakan event listener pada body atau dokumen untuk memastikan gesture pengguna
    // Ini harus dipanggil SETELAH AudioContext diinisialisasi
    function setupAudioContextResumeListeners() {
        const resumeEvents = ['click', 'touchstart', 'touchend'];
        resumeEvents.forEach(event => {
            // REVISI: Gunakan { once: true } untuk memastikan hanya sekali dipicu dan tidak mengganggu performa
            document.body.addEventListener(event, resumeAudioContext, { once: true });
        });
    }

    // --- Wavesurfer Initialization and Update ---
    function getWavesurferInstance() {
        // REVISI: Periksa apakah wavesurferInstance sudah ada
        if (wavesurferInstance) {
            return wavesurferInstance;
        }
        
        if (typeof WaveSurfer === 'undefined') {
            console.error('❌ Wavesurfer.js library is not loaded. Check script tag in HTML.');
            if (statusMsg) {
                statusMsg.textContent = 'Visualizer audio tidak dapat dimuat (library Wavesurfer.js hilang).';
                statusMsg.className = 'text-red-600';
            }
            return null; // REVISI: Return null jika Wavesurfer tidak dimuat
        }

        if (!wavesurferContainer) {
            console.warn('⚠️ Wavesurfer container (#waveform) not found. Audio visualizer will not be available.');
            if (statusMsg) {
                statusMsg.textContent = 'Visualizer audio tidak tersedia (kontainer #waveform hilang).';
                statusMsg.className = 'text-yellow-600';
            }
            return null; // REVISI: Return null jika container tidak ditemukan
        }
           
        wavesurferInstance = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4F46E5', // Indigo-600
            progressColor: '#7C3AED', // Purple-600
            height: 80,
            barWidth: 2,
            barRadius: 3,
            responsive: true,
            normalize: true,
            partialRender: false,
            // PENTING: Jika AudioContext sudah diinisialisasi secara eksternal, berikan di sini
            audioContext: initAudioContext(), 
            plugins: []
        });
        
        wavesurferInstance.on('ready', () => {
            console.log('✅ Wavesurfer ready.');
            // REVISI: Set volume wavesurfer sesuai audioPlayer saat ready
            if (audioPlayer) wavesurferInstance.setVolume(audioPlayer.volume);
        });
        
        wavesurferInstance.on('error', (error) => {
            console.error('❌ Wavesurfer error:', error);
            if (statusMsg) {
                statusMsg.textContent = 'Error pada visualizer audio: ' + error.message;
                statusMsg.className = 'text-red-600';
            }
            // Fallback ke HTML5 audio jika Wavesurfer gagal
            if (audioPlayer && currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                audioPlayer.setAttribute('controls', 'true');
            }
        });
        
        wavesurferInstance.on('loading', (progress) => {
            if (statusMsg) {
                statusMsg.textContent = `Memuat visualizer... ${Math.round(progress)}%`;
            }
        });

        // Sinkronisasi Wavesurfer dengan audioPlayer (diperbaiki agar lebih robust)
        if (audioPlayer) {
            let isSeeking = false;
            audioPlayer.addEventListener('play', () => {
                resumeAudioContext(); // Pastikan AudioContext di-resume saat play
                if (wavesurferInstance && wavesurferInstance.getDuration() > 0 && !isSeeking) {
                    wavesurferInstance.play();
                }
            });
            audioPlayer.addEventListener('pause', () => {
                if (wavesurferInstance && wavesurferInstance.isPlaying()) {
                    wavesurferInstance.pause();
                }
            });
            audioPlayer.addEventListener('seeking', () => { isSeeking = true; });
            audioPlayer.addEventListener('seeked', () => {
                isSeeking = false;
                if (wavesurferInstance && wavesurferInstance.getDuration() > 0) {
                    // REVISI: Pastikan pembaruan posisi seek hanya jika Wavesurfer belum memutar atau tidak sedang di-seeking oleh Wavesurfer sendiri
                    if (!wavesurferInstance.isPlaying()) { // Mencegah loop saat Wavesurfer juga memutar
                        wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                    }
                }
            });
            audioPlayer.addEventListener('volumechange', () => {
                if (wavesurferInstance) {
                    wavesurferInstance.setVolume(audioPlayer.volume);
                }
            });
            audioPlayer.addEventListener('timeupdate', () => {
                // REVISI: Update Wavesurfer progress hanya jika audioPlayer yang utama dan Wavesurfer tidak sedang memutar sendiri
                if (wavesurferInstance && wavesurferInstance.getDuration() > 0 && !wavesurferInstance.isPlaying() && !isSeeking) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
            });
        }
        
        console.log('✅ Wavesurfer instance created and initialized.');
        return wavesurferInstance;
    }
       
    async function updateWavesurfer(audioUrl) {
        const ws = getWavesurferInstance();
        if (!ws || !audioUrl) {
            console.warn('⚠️ Tidak dapat memperbarui Wavesurfer: instance atau URL tidak valid.');
            return;
        }
        
        // Memastikan URL adalah absolute untuk Wavesurfer
        let fullAudioUrl = audioUrl;
        // REVISI: Logic ini tidak diperlukan jika backend mengembalikan URL absolut penuh.
        // Jika backend mengembalikan path relatif seperti '/static/audio_output/xxx.mp3',
        // maka logic ini benar. Sesuaikan dengan apa yang benar-benar dikembalikan backend Anda.
        // Asumsi saat ini: backend mengembalikan full absolute URL.
        // if (audioUrl.startsWith('/')) { // Jika relatif, gabungkan dengan API_BASE_URL
        //     fullAudioUrl = API_BASE_URL + audioUrl;
        // }

        if (!fullAudioUrl.startsWith('http')) {
            console.error('❌ URL audio yang dihasilkan bukan URL absolut:', fullAudioUrl);
            if (statusMsg) {
                statusMsg.textContent = 'URL audio tidak valid. Periksa konfigurasi API_BASE_URL atau respons backend.';
                statusMsg.className = 'text-red-600';
            }
            // REVISI: Jangan return, coba muat ke audioPlayer sebagai fallback.
        }
        
        try {
            if (ws.isPlaying()) {
                ws.pause();
            }
            ws.empty();
            
            console.log('🔄 Wavesurfer memuat audio dari:', fullAudioUrl);
            ws.load(fullAudioUrl).then(() => {
                console.log('✅ Wavesurfer berhasil memuat audio baru.');
                if (audioPlayer) {
                    // REVISI: Set wavesurfer.currenttime = audioplayer.currenttime untuk sinkronisasi awal
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
            }).catch(error => {
                console.error('❌ Wavesurfer.load() gagal:', error);
                if (statusMsg) {
                    statusMsg.textContent = 'Gagal memuat audio ke visualizer. Coba putar audio di player standar.';
                    statusMsg.className = 'text-red-600';
                }
                // Fallback ke HTML5 audio jika Wavesurfer gagal
                if (audioPlayer) {
                    audioPlayer.src = fullAudioUrl;
                    audioPlayer.load();
                    audioPlayer.setAttribute('controls', 'true');
                }
            });
        } catch (error) {
            console.error('❌ Error saat memperbarui Wavesurfer:', error);
        }
    }
       
    // --- Generate Instrumental Function ---
    async function generateInstrumental() {
        if (isGenerating) return;
        
        // Pastikan AudioContext di-resume pada interaksi pengguna (klik tombol generate)
        resumeAudioContext(); 

        if (!textInput || !genreSelect || !tempoInput || !generateBtn || !loadingSpinner || !statusMsg || !audioSection) {
            console.error('❌ Beberapa elemen DOM penting tidak ditemukan. Periksa ID HTML Anda.');
            alert('Beberapa bagian penting halaman tidak ditemukan. Mohon refresh halaman atau hubungi administrator.');
            return;
        }
           
        const lyrics = textInput.value.trim();
        const genre = genreSelect.value;
        const tempo = tempoInput.value || 'auto'; 
           
        if (!lyrics) {
            alert('⚠️ Masukkan lirik atau deskripsi musik terlebih dahulu!');
            textInput.focus();
            return;
        }
           
        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        loadingSpinner.classList.remove('hidden');
        statusMsg.textContent = 'Mengirim permintaan ke server...';
        statusMsg.className = 'text-blue-600';
           
        // Reset audio dan UI
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
            audioPlayer.removeAttribute('controls'); // Sembunyikan kontrol saat loading
        }
        // REVISI: Pastikan Wavesurfer juga direset jika ada
        if (wavesurferInstance) {
            wavesurferInstance.pause();
            wavesurferInstance.empty();
            wavesurferInstance.stop(); // REVISI: Stop wavesurfer
        }
           
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Download Audio';
        }
        audioSection.style.display = 'none'; // Sembunyikan hasil lama
           
        // Reset tampilan metadata
        if (genreDisplay) genreDisplay.textContent = 'N/A';
        if (tempoDisplay) tempoDisplay.textContent = 'N/A';
        if (durationDisplay) durationDisplay.textContent = 'N/A';
        if (lyricsWordCountDisplay) lyricsWordCountDisplay.textContent = '0';
        if (lyricsSyllableCountDisplay) lyricsSyllableCountDisplay.textContent = '0';

        try {
            const requestData = {
                lyrics: lyrics,   // ✅ FIX: Menggunakan "lyrics" sesuai backend
                genre: genre,
                tempo: tempo      // Tempo tidak digunakan di backend, tapi tidak masalah dikirim
            };
               
            console.log('📤 Mengirim permintaan ke:', `${API_BASE_URL}/generate-instrumental`, requestData);
               
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.warn('⚠️ Permintaan dibatalkan karena timeout (3 menit).');
                statusMsg.textContent = 'Permintaan melebihi batas waktu (3 menit). Coba lagi dengan lirik yang lebih pendek atau periksa koneksi server.';
                statusMsg.className = 'text-red-600';
            }, 180000); // Timeout 3 menit (180 detik)
               
            const response = await fetch(`${API_BASE_URL}/generate-instrumental`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
               
            clearTimeout(timeoutId);
               
            if (!response.ok) {
                // REVISI: Penanganan error lebih detail
                let errorMessage = `HTTP error! Status: ${response.status} (${response.statusText})`;
                try {
                    const errorBody = await response.json();
                    if (errorBody && errorBody.error) {
                        errorMessage = errorBody.error; // Menggunakan pesan error dari backend
                    }
                } catch (jsonError) {
                    console.warn('⚠️ Gagal mengurai respons error sebagai JSON:', jsonError);
                }
                throw new Error(errorMessage);
            }
               
            const result = await response.json();
            console.log('📥 Respon diterima:', result);
               
            // REVISI: Cek properti 'error' atau 'success' yang dikembalikan oleh backend
            if (result.error) { // Jika backend secara eksplisit mengembalikan 'error'
                throw new Error(result.error);
            }
            if (!result.success) { // Jika backend tidak mengembalikan 'success: true'
                 throw new Error(result.message || 'Server mengembalikan respons yang tidak berhasil.');
            }
            
            // Backend sekarang mengembalikan audio_url (path relatif) dan download_url (URL absolut)
            // Asumsi: audio_url adalah path relatif seperti "/static/audio_output/file.mp3"
            //         download_url adalah URL absolut, atau bisa kita bangun di frontend
            if (!result.filename || !result.audio_url) {
                throw new Error('Server tidak mengembalikan nama file atau URL audio yang valid.');
            }
               
            // REVISI: currentAudioUrl HARUS URL ABSOLUT untuk Wavesurfer dan HTML5 player
            currentAudioUrl = `${API_BASE_URL}${result.audio_url}`;
            // REVISI: currentDownloadUrl HARUS URL ABSOLUT untuk download
            // Jika backend memberikan URL download terpisah, gunakan itu.
            // Jika tidak, kita bisa membuatnya dari audio_url.
            currentDownloadUrl = result.download_url || currentAudioUrl; // Fallback jika backend tidak memberi download_url
            
            console.log('🎵 URL Audio untuk player (absolut):', currentAudioUrl);
            console.log('📥 URL Download (absolut):', currentDownloadUrl);
               
            audioSection.style.display = 'block'; // Tampilkan bagian hasil
            
            // --- DEBUGGING METADATA ---
            console.log('🔍 DEBUG: Updating metadata UI...');
            console.log('Received result for metadata:', result); // Log hasil keseluruhan untuk debugging

            // REVISI: Pastikan properti yang diakses sesuai dengan respons backend
            // Backend Flask Anda mengembalikan 'genre', 'tempo', 'duration', 'id', 'audio_url', 'filename'
            // word_count dan syllable_count belum ada di backend
            if (genreDisplay) {
                const genreValue = result.genre || 'N/A';
                genreDisplay.textContent = genreValue;
                console.log(`✅ Genre updated: "${genreValue}"`);
            } else {
                console.error('❌ genreDisplay element not found or is null!');
            }

            if (tempoDisplay) {
                const tempoValue = (result.tempo ? `${result.tempo} BPM` : 'N/A'); // REVISI: Tambah ' BPM'
                tempoDisplay.textContent = tempoValue;
                console.log(`✅ Tempo updated: "${tempoValue}"`);
            } else {
                console.error('❌ tempoDisplay element not found or is null!');
            }

            if (durationDisplay) {
                const durationValue = (result.duration ? `${result.duration} detik` : 'N/A'); // REVISI: Tambah ' detik'
                durationDisplay.textContent = durationValue;
                console.log(`✅ Duration updated: "${durationValue}"`);
            } else {
                console.error('❌ durationDisplay element not found or is null!');
            }

            // REVISI: Properti ini belum dikembalikan oleh backend, akan selalu 0/N/A
            if (lyricsWordCountDisplay) {
                const wordCountValue = result.lyrics_word_count || '0'; 
                lyricsWordCountDisplay.textContent = wordCountValue;
                console.log(`✅ Word count updated: "${wordCountValue}"`);
            } else {
                console.error('❌ lyricsWordCountDisplay element not found or is null!');
            }

            // REVISI: Properti ini belum dikembalikan oleh backend, akan selalu 0/N/A
            if (lyricsSyllableCountDisplay) {
                const syllableCountValue = result.lyrics_syllable_count || '0';
                lyricsSyllableCountDisplay.textContent = syllableCountValue;
                console.log(`✅ Syllable count updated: "${syllableCountValue}"`);
            } else {
                console.error('❌ lyricsSyllableCountDisplay element not found or is null!');
            }
            console.log('🔍 DEBUG: Metadata UI update complete.');
            // --- AKHIR DEBUGGING METADATA ---
            
            // Set HTML5 audio player
            if (audioPlayer) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load(); // Memuat audio
                audioPlayer.setAttribute('controls', 'true'); // Tampilkan kontrol setelah loading
                
                audioPlayer.addEventListener('canplaythrough', () => { // Gunakan canplaythrough
                    console.log('✅ Audio siap diputar di HTML5 player.');
                    if (statusMsg) {
                        statusMsg.textContent = 'Audio siap diputar! Klik tombol play 🎵';
                        statusMsg.className = 'text-green-600';
                    }
                }, { once: true });
                   
                audioPlayer.addEventListener('error', (e) => {
                    console.error('❌ HTML5 Audio player error:', e);
                    if (statusMsg) {
                        statusMsg.textContent = 'Error memuat file audio di player standar. Periksa konsol browser.';
                        statusMsg.className = 'text-red-600';
                    }
                });
            }
               
            // Update Wavesurfer jika URL adalah MP3/WAV
            if (currentAudioUrl.endsWith('.mp3') || currentAudioUrl.endsWith('.wav')) {
                // Memuat Wavesurfer setelah audioPlayer mulai memuat
                // atau setelah jeda singkat untuk memastikan AudioContext aktif
                // REVISI: Panggil updateWavesurfer langsung, Wavesurfer akan handle loading.
                // Tidak perlu setTimeout yang berpotensi menyebabkan race condition.
                // Wavesurfer.js juga akan mengurus AudioContext-nya sendiri jika diberikan.
                updateWavesurfer(currentAudioUrl);
            } else {
                console.warn('⚠️ Format audio tidak didukung oleh visualizer (hanya MP3/WAV). Player standar akan digunakan.');
                if (statusMsg) {
                    statusMsg.textContent = 'Format audio tidak didukung visualizer. Gunakan player standar.';
                    statusMsg.className = 'text-yellow-600';
                }
            }
            
            if (downloadBtn) {
                downloadBtn.disabled = false;
                // REVISI: filesize_kb belum dikembalikan oleh backend.
                // Jika ingin menampilkan ukuran, backend harus mengembalikan properti tersebut.
                // Contoh: downloadBtn.textContent = `Download (${result.filesize_kb ? result.filesize_kb + ' KB' : 'Audio'})`;
                downloadBtn.textContent = `Download Audio`; 
            }

            // REVISI: Kondisi ini bisa dihapus karena statusMsg akan diupdate di tempat lain
            // if (statusMsg && !statusMsg.textContent.includes("Error")) {
            //     // Biarkan statusMsg diperbarui oleh canplaythrough event listener
            // }
               
            audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
               
        } catch (error) {
            console.error('❌ Error saat generate instrumental:', error);
               
            let errorMsg = 'Terjadi kesalahan: ';
            if (error.name === 'AbortError') {
                errorMsg += 'Permintaan melebihi batas waktu (3 menit). Coba lagi dengan lirik yang lebih pendek atau periksa koneksi server.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch') || error.message.includes('Failed to load resource')) {
                errorMsg += 'Tidak dapat terhubung ke server. Pastikan backend Flask berjalan dan bisa diakses.';
            } else if (error.message.includes('Method Not Allowed')) {
                errorMsg += 'Backend menolak metode permintaan (CORS issue?). Pastikan Anda menggunakan URL backend yang benar di API_BASE_URL.';
            } else {
                errorMsg += error.message;
            }
               
            if (statusMsg) {
                statusMsg.textContent = errorMsg;
                statusMsg.className = 'text-red-600';
            }
            // REVISI: Hapus alert() untuk UX yang lebih baik, cukup tampilkan di statusMsg
            // alert(errorMsg); 
               
        } finally {
            isGenerating = false;
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Instrumental 🎵';
            }
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }
       
    // --- Download Handler ---
    function downloadAudio() {
        if (!currentDownloadUrl) { // Gunakan currentDownloadUrl yang absolut
            alert('⚠️ Tidak ada file audio untuk di-download!');
            return;
        }
           
        try {
            const link = document.createElement('a');
            link.href = currentDownloadUrl; // Gunakan URL absolut dari backend
               
            // Backend sudah memberikan filename, gunakan itu jika ada di URL
            let filename = `instrumental_${new Date().toISOString().slice(0, 10)}.mp3`;
            const urlParts = currentDownloadUrl.split('/');
            const potentialFilename = urlParts[urlParts.length - 1];
            if (potentialFilename.match(/^[a-f0-9]{8}_[0-9]+\.(mp3|wav|mid)$/)) { // Validasi format filename
                 filename = potentialFilename;
            }
            link.download = filename;
               
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
               
            console.log('📥 Download dimulai:', link.download);
               
        } catch (error) {
            console.error('❌ Download error:', error);
            alert('Gagal mendownload file. Coba klik kanan pada player audio dan pilih "Save audio as..."');
        }
    }
       
    // --- Event Listeners ---
    if (generateBtn) {
        generateBtn.addEventListener('click', generateInstrumental);
    }
       
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadAudio);
    }
       
    // Keyboard shortcuts
    document.addEventListener('keydown', async (e) => {
        // REVISI: Pastikan hanya tombol generate yang aktif ketika Ctrl/Cmd + Enter ditekan
        if (textInput && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!generateBtn.disabled) { // REVISI: Hanya generate jika tombol tidak disabled
                await generateInstrumental();
            }
        }
           
        const isInputActive = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (e.key === ' ' && !isInputActive) {
            e.preventDefault();
            // PENTING: Panggil resumeAudioContext() sebelum play()
            resumeAudioContext(); 
            if (wavesurferInstance && wavesurferInstance.isReady && currentAudioUrl) { // REVISI: Periksa wavesurferInstance.isReady
                if (wavesurferInstance.isPlaying()) {
                    wavesurferInstance.pause();
                } else {
                    await wavesurferInstance.play().catch(err => console.warn('Wavesurfer play failed:', err));
                }
            } else if (audioPlayer && audioPlayer.src) {
                if (!audioPlayer.paused) {
                    audioPlayer.pause();
                } else {
                    await audioPlayer.play().catch(err => console.warn('Audio player play failed:', err));
                }
            }
        }
    });
       
    // Form validation dan character count
    if (textInput) {
        textInput.addEventListener('input', () => {
            const charCount = textInput.value.length;
            const maxLength = 2000;
               
            if (charCount > maxLength) {
                textInput.value = textInput.value.substring(0, maxLength);
                if (charCountDisplay) charCountDisplay.textContent = `${maxLength} karakter (maksimum)`;
                if (statusMsg) {
                    statusMsg.textContent = `Peringatan: Teks dibatasi hingga ${maxLength} karakter.`;
                    statusMsg.className = 'text-yellow-600';
                }
            } else {
                if (charCountDisplay) charCountDisplay.textContent = `${charCount} karakter`;
                if (statusMsg) {
                    if (charCount === 0) {
                        statusMsg.textContent = 'Masukkan lirik atau deskripsi musik...';
                        statusMsg.className = 'text-gray-500';
                    } else {
                        statusMsg.textContent = 'Siap untuk generate!';
                        statusMsg.className = 'text-gray-600';
                    }
                }
            }
        });
        if (charCountDisplay) charCountDisplay.textContent = `${textInput.value.length} karakter`;
    }
       
    // --- Inisialisasi Saat Halaman Dimuat ---
    initAudioContext();
    getWavesurferInstance(); 
    setupAudioContextResumeListeners(); // Setup listener setelah AudioContext diinisialisasi
       
    // Contoh lirik otomatis jika kosong - DIPERBAIKI SyntaxError di sini
    if (textInput && !textInput.value.trim()) {
        // REVISI: Menggunakan template literal (backticks) untuk string multiline
        textInput.value = `[verse]
Sebuah melodi indah dengan piano lembut dan senar halus
[chorus]
Emosi yang meningkat menuju klimaks yang kuat`; 
        if (statusMsg) {
            statusMsg.textContent = 'Contoh lirik dimuat. Edit dan klik "Generate Instrumental"!';
            statusMsg.className = 'text-blue-600';
        }
    }
       
    console.log('🚀 Frontend setup complete.');
});
   
// --- Global Error Handling untuk debugging ---
window.addEventListener('error', (event) => {
    // REVISI: Perbaikan pesan error agar lebih spesifik dan tidak mengacaukan log
    console.error('💥 Global error (unhandled exception):', event.error);
    const nonCritical = [
        'clearMessagesCache', '-moz-osx-font-smoothing', '-webkit-text-size-adjust',
        'DOMException: The operation was aborted', 'Invalid URI. Load of media resource  failed',
        'TypeError: playPauseBtn is null', 'Failed to load media', 'A network error occurred',
        'SyntaxError: '' string literal contains an unescaped line break' // REVISI: Tambahkan ini
    ];
    // REVISI: Cek event.message dan event.filename/event.lineno untuk debugging SyntaxError
    const isCritical = !nonCritical.some(msg => 
        (event.message && event.message.includes(msg)) || 
        (event.error && event.error.message && event.error.message.includes(msg))
    );
       
    if (isCritical) {
        console.warn('⚡️ KESALAHAN KRITIS: ', event.message || event.error.message);
    }
});
   
window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection (frontend):', event.reason);
    event.preventDefault();
});

