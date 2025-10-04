// script.js - Final Revised Version for generate-instrumental
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental script loaded. DOM content is ready.');
    
    // --- KONFIGURASI PENTING ---
    // GANTI INI DENGAN URL BACKEND FLASK ANDA JIKA BERBEDA DARI LOKAL!
    // Contoh jika backend di localhost:5000:
    const API_BASE_URL = 'http://localhost:5000';
    // Contoh jika backend di deploy ke server:
    // const API_BASE_URL = 'https://api.yourdomain.com'; 
    // Atau jika frontend dan backend di server yang sama dan Anda ingin menggunakan path relatif:
    // const API_BASE_URL = ''; 
    // Jika Anda menjalankan frontend dari GitHub Pages dan backend dari Pinggy:
    // const API_BASE_URL = 'https://dindwwctyp.a.pinggy.link'; // Ganti dengan URL Pinggy Anda
    
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
    
    // --- State ---
    let wavesurferInstance = null;
    let currentAudioUrl = null;
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
    function getWavesurferInstance() { // Tidak lagi async karena dimuat global
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
            if (audioPlayer && currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
            }
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
            audioPlayer.addEventListener('play', () => wavesurferInstance.play());
            audioPlayer.addEventListener('pause', () => wavesurferInstance.pause());
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
        }
        
        console.log('✅ Wavesurfer instance created and initialized.');
        return wavesurferInstance;
    }
       
    async function updateWavesurfer(audioUrl) {
        const ws = getWavesurferInstance(); // Panggil non-async
        if (!ws || !audioUrl) {
            console.warn('⚠️ Tidak dapat memperbarui Wavesurfer: instance atau URL tidak valid.');
            return;
        }
        
        if (!audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
            console.warn('⚠️ URL audio dari server tidak valid:', audioUrl);
            if (statusMsg) {
                statusMsg.textContent = 'URL audio dari server tidak valid. Periksa konsol backend.';
                statusMsg.className = 'text-red-600';
            }
            return;
        }
        
        try {
            if (ws.isPlaying()) {
                ws.pause();
            }
            ws.empty(); // Bersihkan waveform yang lama
            
            ws.load(audioUrl).then(() => {
                console.log('✅ Wavesurfer memuat audio baru:', audioUrl);
                if (statusMsg) {
                    statusMsg.textContent = 'Audio dimuat ke visualizer.';
                    statusMsg.className = 'text-green-600';
                }
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = 'Download Audio';
                }
            }).catch(error => {
                console.error('❌ Wavesurfer.load() gagal:', error);
                if (statusMsg) {
                    statusMsg.textContent = 'Gagal memuat audio ke visualizer. Coba putar audio di player standar.';
                    statusMsg.className = 'text-red-600';
                }
                // Fallback ke HTML5 audio jika Wavesurfer gagal
                if (audioPlayer) {
                    audioPlayer.src = audioUrl;
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
                text: lyrics,
                genre: genre,
                tempo: tempo
            };
               
            console.log('📤 Mengirim permintaan ke:', `${API_BASE_URL}/generate-instrumental`, requestData);
               
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // Timeout 3 menit (180 detik)
               
            const response = await fetch(`${API_BASE_URL}/generate-instrumental`, { // Gunakan API_BASE_URL di sini!
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
               
            clearTimeout(timeoutId);
               
            if (!response.ok) {
                // Tangkap error dengan lebih baik
                let errorMessage = `HTTP error! Status: ${response.status}`;
                try {
                    const errorBody = await response.json();
                    errorMessage = errorBody.error || errorBody.message || errorMessage;
                } catch (jsonError) {
                    errorMessage = `${response.statusText || 'Unknown error'} (Failed to parse error response).`;
                }
                throw new Error(errorMessage);
            }
               
            const result = await response.json();
            console.log('📥 Respon diterima:', result);
               
            if (result.error) {
                throw new Error(result.error);
            }
               
            if (!result.wav_url && !result.midi_url) {
                throw new Error('Server tidak mengembalikan URL audio yang valid.');
            }
               
            currentAudioUrl = API_BASE_URL + (result.wav_url || result.midi_url); // Gabungkan dengan API_BASE_URL untuk path relatif
            console.log('🎵 URL Audio yang akan digunakan:', currentAudioUrl);
               
            audioSection.style.display = 'block'; // Tampilkan bagian hasil
               
            // Set HTML5 audio player
            if (audioPlayer) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                
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
                setTimeout(() => {
                    updateWavesurfer(currentAudioUrl);
                }, 500); 
            } else {
                console.warn('⚠️ Format audio tidak didukung oleh visualizer (hanya MP3/WAV). Player standar akan digunakan.');
                if (statusMsg) {
                    statusMsg.textContent = 'Format audio tidak didukung visualizer. Gunakan player standar.';
                    statusMsg.className = 'text-yellow-600';
                }
                if (downloadBtn) { // Tetap aktifkan download
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = 'Download Audio';
                }
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
        if (!currentAudioUrl) {
            alert('⚠️ Tidak ada file audio untuk di-download!');
            return;
        }
           
        try {
            const link = document.createElement('a');
            link.href = currentAudioUrl;
               
            let filename = `instrumental_${new Date().toISOString().slice(0, 10)}.mp3`;
            if (currentAudioUrl.includes('/static/audio_output/')) {
                filename = currentAudioUrl.split('/').pop();
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
           
        if (e.key === ' ' && (audioPlayer || wavesurferInstance)) {
            e.preventDefault();
            if (wavesurferInstance && wavesurferInstance.isReady && wavesurferInstance.isPlaying()) {
                wavesurferInstance.pause();
            } else if (wavesurferInstance && wavesurferInstance.isReady && !wavesurferInstance.isPlaying()) {
                await wavesurferInstance.play().catch(err => console.warn('Wavesurfer play failed:', err));
            } else if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
            } else if (audioPlayer && audioPlayer.src) {
                await audioPlayer.play().catch(err => console.warn('Audio player play failed:', err));
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
        'TypeError: playPauseBtn is null' // Tambahkan ini jika Anda masih melihatnya
    ];
    const isCritical = !nonCritical.some(msg => event.error.message.includes(msg) || (event.error.stack && event.error.stack.includes(msg)));
       
    if (isCritical) {
        console.warn('⚡️ KESALAHAN KRITIS: ', event.error.message);
    }
});
   
window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection (frontend):', event.reason);
    event.preventDefault();
});
