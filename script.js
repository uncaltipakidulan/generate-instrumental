// script.js - Final Revised Version for generate-instrumental
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental script loaded. DOM content is ready.');
    
    // --- KONFIGURASI PENTING ---
    // GANTI INI DENGAN URL BACKEND FLASK ANDA JIKA BERBEDA DARI LOKAL!
    // Jika backend berjalan lokal di port 5000:
    // const API_BASE_URL = 'http://127.0.0.1:5000';
    // Jika Anda menggunakan Pinggy atau layanan tunneling lain:
    const API_BASE_URL = 'https://dindwwctyp.a.pinggy.link'; // Ganti dengan URL Pinggy Anda
    // Contoh jika backend di deploy ke server:
    // const API_BASE_URL = 'https://api.yourdomain.com'; 
    // Atau jika frontend dan backend di server yang sama dan Anda ingin menggunakan path relatif:
    // const API_BASE_URL = ''; 
    
    // --- DOM Elements ---
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
    const genreDisplay = document.getElementById('genreDisplay');
    const tempoDisplay = document.getElementById('tempoDisplay');
    const durationDisplay = document.getElementById('durationDisplay');
    const lyricsWordCountDisplay = document.getElementById('lyricsWordCountDisplay');
    const lyricsSyllableCountDisplay = document.getElementById('lyricsSyllableCountDisplay');

    
    // --- State ---
    let wavesurferInstance = null;
    let currentAudioUrl = null;
    let currentDownloadUrl = null; // Tambahkan ini untuk URL download
    let isGenerating = false;
    let audioContext = null;
    
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
            audioContext.resume().then(() => {
                console.log('✅ AudioContext resumed.');
            }).catch(err => {
                console.warn('⚠️ Failed to resume AudioContext:', err);
            });
        }
    }
    
    // Event listener untuk user gesture pada seluruh dokumen
    document.addEventListener('click', resumeAudioContext, { once: true, passive: true });
    document.addEventListener('touchstart', resumeAudioContext, { once: true, passive: true });
    
    // --- Wavesurfer Initialization and Update ---
    // Fungsi untuk menginisialisasi atau mendapatkan instance Wavesurfer
    function getWavesurferInstance() {
        if (wavesurferInstance) {
            return wavesurferInstance;
        }
        
        // Pastikan Wavesurfer global sudah dimuat
        if (typeof WaveSurfer === 'undefined') {
            console.error('❌ Wavesurfer.js library is not loaded. Check script tag in HTML.');
            if (statusMsg) {
                statusMsg.textContent = 'Visualizer audio tidak dapat dimuat (library Wavesurfer.js hilang).';
                statusMsg.className = 'text-red-600';
            }
            return null;
        }

        if (!wavesurferContainer) {
            console.warn('⚠️ Wavesurfer container (#waveform) not found. Audio visualizer will not be available.');
            if (statusMsg) {
                statusMsg.textContent = 'Visualizer audio tidak tersedia (kontainer #waveform hilang).';
                statusMsg.className = 'text-yellow-600';
            }
            return null;
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
            plugins: [] // Mulai tanpa plugin
        });
        
        // Event listeners untuk Wavesurfer
        wavesurferInstance.on('ready', () => {
            console.log('✅ Wavesurfer ready.');
            if (statusMsg) {
                statusMsg.textContent = 'Visualizer audio siap!';
                statusMsg.className = 'text-green-600';
            }
            // Sync player standar jika Wavesurfer selesai loading
            // Jangan langsung set audioPlayer.src di sini, karena sudah diatur di generateInstrumental
            // audioPlayer.load(); // Ini bisa memicu re-load jika tidak hati-hati
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
            }
        });
        
        wavesurferInstance.on('loading', (progress) => {
            if (statusMsg) {
                statusMsg.textContent = `Memuat visualizer... ${Math.round(progress)}%`;
            }
        });

        // Sinkronisasi Wavesurfer dengan audioPlayer
        if (audioPlayer) {
            audioPlayer.addEventListener('play', () => {
                if (wavesurferInstance && currentAudioUrl && wavesurferInstance.getDuration() > 0) wavesurferInstance.play();
            });
            audioPlayer.addEventListener('pause', () => {
                if (wavesurferInstance && wavesurferInstance.isPlaying()) wavesurferInstance.pause();
            });
            audioPlayer.addEventListener('seeked', () => {
                if (wavesurferInstance && wavesurferInstance.getDuration() > 0) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
            });
            audioPlayer.addEventListener('volumechange', () => {
                if (wavesurferInstance) {
                    wavesurferInstance.setVolume(audioPlayer.volume);
                }
            });
            audioPlayer.addEventListener('timeupdate', () => {
                if (wavesurferInstance && wavesurferInstance.getDuration() > 0 && !wavesurferInstance.isPlaying()) {
                    // Update wavesurfer position manually if audioPlayer is playing but wavesurfer is not
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
        if (audioUrl.startsWith('/')) { // Jika relatif, gabungkan dengan API_BASE_URL
            fullAudioUrl = API_BASE_URL + audioUrl;
        }

        if (!fullAudioUrl.startsWith('http')) {
            console.error('❌ URL audio yang dihasilkan bukan URL absolut:', fullAudioUrl);
            if (statusMsg) {
                statusMsg.textContent = 'URL audio tidak valid. Periksa konfigurasi API_BASE_URL atau respons backend.';
                statusMsg.className = 'text-red-600';
            }
            return;
        }
        
        try {
            if (ws.isPlaying()) {
                ws.pause();
            }
            ws.empty(); // Bersihkan waveform yang lama
            
            console.log('🔄 Wavesurfer memuat audio dari:', fullAudioUrl);
            ws.load(fullAudioUrl).then(() => {
                console.log('✅ Wavesurfer berhasil memuat audio baru.');
                if (statusMsg) {
                    statusMsg.textContent = 'Audio dimuat ke visualizer.';
                    statusMsg.className = 'text-green-600';
                }
                // Tombol download akan diaktifkan di generateInstrumental, bukan di sini
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
                }
            });
        } catch (error) {
            console.error('❌ Error saat memperbarui Wavesurfer:', error);
        }
    }
       
    // --- Generate Instrumental Function ---
    async function generateInstrumental() {
        if (isGenerating) return;
        
        // Pengecekan elemen DOM
        if (!textInput || !genreSelect || !tempoInput || !generateBtn || !loadingSpinner || !statusMsg || !audioSection) {
            console.error('❌ Beberapa elemen DOM penting tidak ditemukan. Periksa ID HTML Anda.');
            alert('Beberapa bagian penting halaman tidak ditemukan. Mohon refresh halaman atau hubungi administrator.');
            return;
        }
           
        const lyrics = textInput.value.trim();
        const genre = genreSelect.value;
        // Tempo tidak digunakan di backend Flask Anda, tapi bisa tetap dikirim
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
           
        if (wavesurferInstance) {
            wavesurferInstance.pause();
            wavesurferInstance.empty();
        }
           
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Download Audio';
        }
        audioSection.style.display = 'none'; // Sembunyikan hasil lama
           
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
                statusMsg.textContent = 'Permintaan melebihi batas waktu (3 menit). Coba lagi dengan lirik yang lebih pendek.';
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
                let errorMessage = `HTTP error! Status: ${response.status}`;
                try {
                    const errorBody = await response.json();
                    errorMessage = errorBody.error || errorBody.message || errorMessage;
                } catch (jsonError) {
                    errorMessage = `${response.statusText || 'Unknown error'} (Gagal mengurai respons error).`;
                }
                throw new Error(errorMessage);
            }
               
            const result = await response.json();
            console.log('📥 Respon diterima:', result);
               
            if (result.status === 'error' || result.error) {
                throw new Error(result.error || result.message || 'Server mengembalikan status error.');
            }
            
            // Backend sekarang mengembalikan audio_url (relatif) dan download_url (absolut)
            if (!result.audio_url || !result.download_url) {
                throw new Error('Server tidak mengembalikan URL audio yang valid.');
            }
               
            currentAudioUrl = API_BASE_URL + result.audio_url; // URL untuk player Wavesurfer/HTML5 (harus absolut)
            currentDownloadUrl = result.download_url; // URL absolut untuk download
            
            console.log('🎵 URL Audio untuk player:', currentAudioUrl);
            console.log('📥 URL Download:', currentDownloadUrl);
               
            audioSection.style.display = 'block'; // Tampilkan bagian hasil
               
            // Set HTML5 audio player
            if (audioPlayer) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                audioPlayer.setAttribute('controls', 'true'); // Tampilkan kontrol setelah loading
                
                audioPlayer.addEventListener('canplay', () => {
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
                // Beri sedikit jeda agar player HTML5 sempat memuat metadata awal
                setTimeout(() => {
                    updateWavesurfer(currentAudioUrl);
                }, 500); 
            } else {
                console.warn('⚠️ Format audio tidak didukung oleh visualizer (hanya MP3/WAV). Player standar akan digunakan.');
                if (statusMsg) {
                    statusMsg.textContent = 'Format audio tidak didukung visualizer. Gunakan player standar.';
                    statusMsg.className = 'text-yellow-600';
                }
            }
            
            // Update info di UI
            if (genreDisplay) genreDisplay.textContent = result.genre || 'N/A';
            if (tempoDisplay) tempoDisplay.textContent = result.tempo || 'N/A';
            if (durationDisplay) durationDisplay.textContent = result.estimated_duration || 'N/A';
            if (lyricsWordCountDisplay) lyricsWordCountDisplay.textContent = result.lyrics_word_count || '0';
            if (lyricsSyllableCountDisplay) lyricsSyllableCountDisplay.textContent = result.lyrics_syllable_count || '0';

            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = `Download (${result.filesize_kb} KB)`;
            }

            if (statusMsg && !statusMsg.textContent.includes("Error")) {
                statusMsg.textContent = 'Instrumental berhasil dibuat! 🎉';
                statusMsg.className = 'text-green-600';
            }
               
            audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
               
        } catch (error) {
            console.error('❌ Error saat generate instrumental:', error);
               
            let errorMsg = 'Terjadi kesalahan: ';
            if (error.name === 'AbortError') {
                errorMsg += 'Permintaan melebihi batas waktu (3 menit). Coba lagi dengan lirik yang lebih pendek atau periksa koneksi server.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
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
            alert(errorMsg);
               
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
        if (textInput && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            await generateInstrumental();
        }
           
        // Hanya memproses spasi jika tidak sedang di input/textarea
        const isInputActive = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (e.key === ' ' && !isInputActive) {
            e.preventDefault();
            if (wavesurferInstance && wavesurferInstance.isReady && currentAudioUrl) {
                if (wavesurferInstance.isPlaying()) {
                    wavesurferInstance.pause();
                } else {
                    await wavesurferInstance.play().catch(err => console.warn('Wavesurfer play failed:', err));
                }
            } else if (audioPlayer && audioPlayer.src) { // Fallback ke player standar
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
    getWavesurferInstance(); // Panggil ini untuk memastikan Wavesurfer diinisialisasi
       
    // Contoh lirik otomatis jika kosong
    if (textInput && !textInput.value.trim()) {
        textInput.value = '[verse]\nSebuah melodi indah dengan piano lembut dan senar halus\n[chorus]\nEmosi yang meningkat menuju klimaks yang kuat';
        if (statusMsg) {
            statusMsg.textContent = 'Contoh lirik dimuat. Edit dan klik "Generate Instrumental"!';
            statusMsg.className = 'text-blue-600';
        }
    }
       
    console.log('🚀 Frontend setup complete.');
});
   
// --- Global Error Handling untuk debugging ---
window.addEventListener('error', (event) => {
    console.error('💥 Global error (unhandled exception):', event.error);
    const nonCritical = [
        'clearMessagesCache', '-moz-osx-font-smoothing', '-webkit-text-size-adjust',
        'DOMException: The operation was aborted', 'Invalid URI. Load of media resource  failed',
        'TypeError: playPauseBtn is null', 'Failed to load media' 
    ]; // Tambah 'Failed to load media'
    const isCritical = !nonCritical.some(msg => event.error.message.includes(msg) || (event.error.stack && event.error.stack.includes(msg)));
       
    if (isCritical) {
        console.warn('⚡️ KESALAHAN KRITIS: ', event.error.message);
    }
});
   
window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection (frontend):', event.reason);
    event.preventDefault();
});
