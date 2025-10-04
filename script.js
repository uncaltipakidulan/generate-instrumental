// script.js - Final Fixed version for generate-instrumental
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental frontend loaded');
    
    // --- DOM Elements (Accessed Safely) ---
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
    const playPauseBtn = document.getElementById('playPauseBtn'); // <-- ELEMEN BARU

    // --- State ---
    let wavesurfer = null;
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
                console.warn('⚠️ AudioContext not supported:', error);
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
    
    // Resume AudioContext on user interaction
    // We attach this to document-level events to catch any early user gesture
    document.addEventListener('click', resumeAudioContext, { once: true, passive: true });
    document.addEventListener('touchstart', resumeAudioContext, { once: true, passive: true });
    
    // --- Wavesurfer Initialization and Update ---
    function initWavesurfer() {
        if (!wavesurferContainer) {
            console.warn('⚠️ Wavesurfer container (#waveform) not found. Visualizer will not be displayed.');
            if (statusMsg) statusMsg.textContent = 'Visualizer tidak aktif (kontainer #waveform tidak ditemukan).';
            return;
        }

        // Import Wavesurfer dynamically
        import('https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js')
            .then(({ WaveSurfer }) => {
                // Destroy previous instance if it exists
                if (wavesurfer) {
                    wavesurfer.destroy();
                    wavesurfer = null;
                }

                wavesurfer = WaveSurfer.create({
                    container: wavesurferContainer, // Pass the DOM element directly
                    waveColor: '#4F46E5',
                    progressColor: '#7C3AED',
                    height: 80,
                    barWidth: 2,
                    barRadius: 3,
                    responsive: true,
                    normalize: true,
                    partialRender: false,
                    plugins: [] // Explicitly no plugins
                });
                
                console.log('✅ Wavesurfer instance created.');
                
                // --- Wavesurfer Event Listeners ---
                wavesurfer.on('ready', () => {
                    console.log('✅ Wavesurfer ready. Audio loaded into visualizer.');
                    if (statusMsg) {
                        statusMsg.textContent = 'Audio siap diputar di visualizer 🎵';
                        statusMsg.className = 'text-green-600';
                    }
                    if (audioPlayer && currentAudioUrl) {
                        // Ensure HTML5 player has the correct source if Wavesurfer loads it
                        if (audioPlayer.src !== wavesurfer.getMediaElement().src) {
                             audioPlayer.src = wavesurfer.getMediaElement().src;
                             audioPlayer.load();
                        }
                    }
                    if (playPauseBtn) playPauseBtn.disabled = false;
                    if (downloadBtn) downloadBtn.disabled = false;
                });
                
                wavesurfer.on('error', (error) => {
                    console.error('❌ Wavesurfer error:', error);
                    if (statusMsg) {
                        statusMsg.textContent = 'Error visualizer: ' + error.message + '. Menggunakan player standar.';
                        statusMsg.className = 'text-red-600';
                    }
                    // Fallback to HTML5 audio only
                    if (audioPlayer && currentAudioUrl) {
                        audioPlayer.src = currentAudioUrl;
                        audioPlayer.load();
                        if (playPauseBtn) playPauseBtn.disabled = false;
                    }
                });
                
                wavesurfer.on('loading', (progress) => {
                    if (statusMsg) {
                        statusMsg.textContent = `Memuat visualizer... ${Math.round(progress)}%`;
                    }
                });

                // Sync HTML5 audio player with Wavesurfer
                wavesurfer.on('play', () => {
                    if (audioPlayer && audioPlayer.paused) {
                        audioPlayer.play().catch(e => console.warn('HTML5 play failed (Wavesurfer triggered):', e));
                    }
                });
                
                wavesurfer.on('pause', () => {
                    if (audioPlayer && !audioPlayer.paused) {
                        audioPlayer.pause();
                    }
                });

                // If HTML5 audio player is played/paused directly
                if (audioPlayer) {
                    audioPlayer.addEventListener('play', () => wavesurfer.play());
                    audioPlayer.addEventListener('pause', () => wavesurfer.pause());
                    audioPlayer.addEventListener('seeked', () => {
                        if (audioPlayer.duration) wavesurfer.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                    });
                }

            })
            .catch(error => {
                console.error('❌ Failed to load Wavesurfer library:', error);
                if (statusMsg) {
                    statusMsg.textContent = 'Gagal memuat visualizer audio. Fungsi dasar tetap berjalan.';
                    statusMsg.className = 'text-yellow-600';
                }
            });
    }
    
    function updateWavesurfer(audioUrl) {
        if (!wavesurfer || !wavesurfer.load || !audioUrl) {
            console.warn('⚠️ Tidak dapat memperbarui Wavesurfer: instance tidak siap atau URL tidak valid.');
            // Fallback: If Wavesurfer is not ready or failed, just load to HTML5 player
            if (audioPlayer && currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                if (playPauseBtn) playPauseBtn.disabled = false;
                if (statusMsg) statusMsg.textContent = 'Visualizer tidak berfungsi, menggunakan player standar.';
            }
            return;
        }
        
        if (!audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
            console.warn('⚠️ URL audio dari server tidak valid:', audioUrl);
            if (statusMsg) statusMsg.textContent = 'URL audio dari server tidak valid. Silakan cek konsol backend.';
            return;
        }
        
        try {
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            }
            wavesurfer.empty(); // Clear old waveform
            
            // Wavesurfer requires MP3/WAV, not MIDI
            if (audioUrl.endsWith('.mp3') || audioUrl.endsWith('.wav')) {
                wavesurfer.load(audioUrl).then(() => {
                    console.log('✅ Wavesurfer loaded new audio:', audioUrl);
                    if (statusMsg) {
                        statusMsg.textContent = 'Audio dimuat ke visualizer.';
                        statusMsg.className = 'text-green-600';
                    }
                    if (downloadBtn) {
                        downloadBtn.disabled = false;
                        downloadBtn.textContent = 'Download MP3'; // Assume MP3, will be corrected by downloadAudio
                    }
                    if (playPauseBtn) playPauseBtn.disabled = false;
                }).catch(error => {
                    console.error('❌ Wavesurfer.load() failed:', error);
                    if (statusMsg) {
                        statusMsg.textContent = 'Gagal memuat audio ke visualizer. Coba putar audio di player standar.';
                        statusMsg.className = 'text-red-600';
                    }
                    // Fallback to HTML5 audio if Wavesurfer fails to load
                    if (audioPlayer) {
                        audioPlayer.src = audioUrl;
                        audioPlayer.load();
                        if (playPauseBtn) playPauseBtn.disabled = false;
                    }
                });
            } else {
                console.warn('⚠️ Format audio tidak didukung oleh Wavesurfer (hanya MP3/WAV). Menggunakan player standar.');
                if (statusMsg) {
                    statusMsg.textContent = 'Format audio tidak didukung visualizer. Gunakan player standar.';
                    statusMsg.className = 'text-yellow-600';
                }
                // Directly load to HTML5 audio if not supported by Wavesurfer
                if (audioPlayer) {
                    audioPlayer.src = audioUrl;
                    audioPlayer.load();
                    if (playPauseBtn) playPauseBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('❌ Error saat memperbarui Wavesurfer:', error);
        }
    }
    
    // --- Generate Instrumental Function ---
    async function generateInstrumental() {
        if (isGenerating) return;
        
        // --- Safe DOM Element Checks ---
        if (!textInput || !genreSelect || !tempoInput || !generateBtn || !loadingSpinner || !audioPlayer || !downloadBtn || !statusMsg || !audioSection || !playPauseBtn) {
            console.error('❌ Salah satu elemen DOM penting tidak ditemukan. Periksa ID HTML Anda.');
            alert('Aplikasi tidak dapat berfungsi. Pastikan semua elemen HTML dengan ID yang benar ada.');
            return;
        }

        const lyrics = textInput.value.trim();
        const genre = genreSelect.value;
        const tempo = tempoInput.value || 'auto';
        
        if (!lyrics) {
            alert('⚠️ Masukkan lirik atau teks terlebih dahulu!');
            textInput.focus();
            return;
        }
        
        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        loadingSpinner.classList.remove('hidden');
        statusMsg.textContent = 'Mengirim permintaan ke server...';
        statusMsg.className = 'text-blue-600';
        
        // Reset previous audio
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.src = '';
        
        if (wavesurfer && wavesurfer.isPlaying()) {
            wavesurfer.pause();
        }
        if (wavesurfer && wavesurfer.empty) { // Check if empty method exists
            wavesurfer.empty();
        }
        
        downloadBtn.disabled = true;
        playPauseBtn.disabled = true; // Disable play/pause during generation
        playPauseBtn.textContent = 'Play / Pause'; // Reset text
        downloadBtn.textContent = 'Download MP3';
        audioSection.classList.add('hidden'); // Sembunyikan hasil lama
        
        try {
            const requestData = {
                text: lyrics,
                genre: genre,
                tempo: tempo
            };
            
            console.log('📤 Sending request:', requestData);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
            
            const response = await fetch('/generate-instrumental', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                const errorMessage = errorBody.error || errorBody.message || `HTTP error! Status: ${response.status}`;
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            console.log('📥 Response received:', result);
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            if (!result.wav_url && !result.midi_url) {
                throw new Error('Server tidak mengembalikan URL audio.');
            }
            
            // Prefer MP3/WAV for direct playback and Wavesurfer
            currentAudioUrl = result.wav_url; // Use wav_url (MP3 format from backend)
            
            audioSection.classList.remove('hidden'); // Tampilkan hasil

            // Set HTML5 audio player
            if (currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load(); // Memuat audio
                
                audioPlayer.addEventListener('canplay', function onCanPlay() {
                    console.log('✅ Audio dapat diputar di HTML5 player.');
                    statusMsg.textContent = 'Audio siap diputar! Klik tombol Play/Pause 🎵';
                    statusMsg.className = 'text-green-600';
                    playPauseBtn.disabled = false;
                    downloadBtn.disabled = false;
                    audioPlayer.removeEventListener('canplay', onCanPlay); // Hapus event listener agar tidak terpicu berulang
                }, { once: true });
                
                audioPlayer.addEventListener('error', (e) => {
                    console.error('❌ HTML5 Audio player error:', e);
                    statusMsg.textContent = 'Error memuat file audio di player standar. Cek konsol.';
                    statusMsg.className = 'text-red-600';
                    playPauseBtn.disabled = true; // Disable if error
                });
            }
            
            // Update Wavesurfer
            // Wavesurfer expects MP3 or WAV, not MIDI
            if (currentAudioUrl && (currentAudioUrl.endsWith('.mp3') || currentAudioUrl.endsWith('.wav'))) {
                setTimeout(() => { // Small delay to ensure server has served the file
                    updateWavesurfer(currentAudioUrl);
                }, 500); 
            } else {
                console.warn('⚠️ Format audio tidak didukung oleh Wavesurfer (hanya MP3/WAV). Menggunakan player standar.');
                statusMsg.textContent = 'Format audio tidak didukung visualizer. Gunakan player standar.';
                statusMsg.className = 'text-yellow-600';
            }
            
            statusMsg.textContent = 'Instrumental berhasil dibuat! 🎉';
            statusMsg.className = 'text-green-600';
            
            // Scroll to audio player
            audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
        } catch (error) {
            console.error('❌ Generate error:', error);
            
            let errorMsg = 'Terjadi kesalahan: ';
            if (error.name === 'AbortError') {
                errorMsg += 'Permintaan melebihi batas waktu (120 detik). Coba lagi dengan lirik yang lebih pendek.';
            } else if (error.message.includes('HTTP error') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMsg += `Tidak dapat terhubung ke server atau server bermasalah: ${error.message}. Pastikan backend Flask berjalan dan bisa diakses.`;
            } else {
                errorMsg += error.message;
            }
            
            statusMsg.textContent = errorMsg;
            statusMsg.className = 'text-red-600';
            alert(errorMsg);
            
        } finally {
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Instrumental 🎵';
            loadingSpinner.classList.add('hidden');
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
            
            let filename = `instrumental_${Date.now()}`;
            // Try to extract filename from URL
            if (currentAudioUrl.includes('/static/audio_output/')) {
                filename = currentAudioUrl.split('/').pop();
            } else if (currentAudioUrl.endsWith('.mp3')) {
                filename = `instrumental_${Date.now()}.mp3`;
            } else if (currentAudioUrl.endsWith('.wav')) {
                filename = `instrumental_${Date.now()}.wav`;
            } else if (currentAudioUrl.endsWith('.mid')) {
                filename = `instrumental_${Date.now()}.mid`;
            }
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('📥 Download dimulai:', link.download);
            
        } catch (error) {
            console.error('❌ Download error:', error);
            alert('Gagal mendownload file. Coba klik kanan pada player dan "Save audio as..."');
        }
    }

    // --- Play/Pause Toggle Handler ---
    function togglePlayPause() {
        if (!currentAudioUrl) {
            if (statusMsg) statusMsg.textContent = 'Tidak ada audio untuk diputar.';
            return;
        }

        if (wavesurfer && wavesurfer.isReady && wavesurfer.getMediaElement()) {
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
                playPauseBtn.textContent = 'Play';
            } else {
                resumeAudioContext(); // Pastikan AudioContext aktif
                wavesurfer.play().then(() => {
                    playPauseBtn.textContent = 'Pause';
                }).catch(e => {
                    console.warn('Wavesurfer play failed:', e);
                    // Fallback to HTML5 audio if Wavesurfer fails to play
                    if (audioPlayer && audioPlayer.src && audioPlayer.paused) {
                        audioPlayer.play().then(() => playPauseBtn.textContent = 'Pause').catch(err => console.warn('HTML5 fallback play failed:', err));
                    }
                });
            }
        } else if (audioPlayer && audioPlayer.src) {
            if (!audioPlayer.paused) {
                audioPlayer.pause();
                playPauseBtn.textContent = 'Play';
            } else {
                resumeAudioContext(); // Pastikan AudioContext aktif
                audioPlayer.play().then(() => {
                    playPauseBtn.textContent = 'Pause';
                }).catch(e => console.warn('HTML5 audio play failed:', e));
            }
        } else {
             if (statusMsg) statusMsg.textContent = 'Audio tidak dimuat atau siap untuk diputar.';
        }
    }

    // --- Event Listeners ---
    if (generateBtn) {
        generateBtn.addEventListener('click', generateInstrumental);
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadAudio);
    }

    if (playPauseBtn) { // <-- DAFTARKAN EVENT LISTENER UNTUK TOMBOL BARU
        playPauseBtn.addEventListener('click', togglePlayPause);
    }

    // Update play/pause button text based on HTML5 audio player state
    if (audioPlayer) {
        audioPlayer.addEventListener('play', () => { if (playPauseBtn) playPauseBtn.textContent = 'Pause'; });
        audioPlayer.addEventListener('pause', () => { if (playPauseBtn) playPauseBtn.textContent = 'Play'; });
        audioPlayer.addEventListener('ended', () => { if (playPauseBtn) playPauseBtn.textContent = 'Play'; });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (textInput && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateInstrumental();
        }
        
        if (e.key === ' ' && (audioPlayer || wavesurfer)) {
            e.preventDefault();
            togglePlayPause(); // Gunakan fungsi toggle yang sudah ada
        }
    });
    
    // Form validation and character count on input
    if (textInput && charCountDisplay && statusMsg) {
        textInput.addEventListener('input', () => {
            const charCount = textInput.value.length;
            const maxLength = 2000;
            
            if (charCount > maxLength) {
                textInput.value = textInput.value.substring(0, maxLength);
                charCountDisplay.textContent = `${maxLength} karakter (maksimum)`;
                statusMsg.textContent = `Teks dibatasi hingga ${maxLength} karakter`;
                statusMsg.className = 'text-yellow-600';
            } else {
                charCountDisplay.textContent = `${charCount} karakter`;
                if (charCount === 0) {
                    statusMsg.textContent = 'Masukkan lirik atau deskripsi musik...';
                    statusMsg.className = 'text-gray-500';
                } else {
                    statusMsg.textContent = ''; // Clear status if user is typing
                    statusMsg.className = 'text-gray-600';
                }
            }
        });
        // Initial character count
        charCountDisplay.textContent = `${textInput.value.length} karakter`;
    }
    
    // --- Initialize on Load ---
    initAudioContext();
    initWavesurfer();

    // Auto-generate example on first load (optional, dan hanya jika textInput ada)
    if (textInput && !textInput.value.trim()) {
        textInput.value = '[verse]\nSebuah melodi indah dengan piano lembut dan senar halus\n[chorus]\nEmosi yang meningkat menuju klimaks yang kuat';
        if (statusMsg) {
            statusMsg.textContent = 'Contoh lirik dimuat. Edit dan klik Generate!';
            statusMsg.className = 'text-blue-600';
        }
    }
    
    console.log('🚀 Frontend initialized successfully');
});

// --- Global Error Handling (for debugging) ---
window.addEventListener('error', (event) => {
    // Only log critical unhandled errors to console, avoid noisy non-critical ones
    if (event.error && !event.error.message.includes('clearMessagesCache') && 
        !event.error.message.includes('moz-osx-font-smoothing') &&
        !event.error.message.includes('webkit-text-size-adjust') &&
        !(event.error.message.includes('DOMException') && event.error.message.includes('aborted')) &&
        !event.error.message.includes('ResizeObserver loop limit exceeded')) { // Add common browser warnings here
        console.error('💥 Global error (unhandled exception):', event.error);
    } else {
        // Log non-critical errors as warnings or info
        console.info('Non-critical/Ignored error logged:', event.error ? event.error.message : 'Unknown error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection (frontend):', event.reason);
    event.preventDefault(); // Prevent default browser logging for unhandled promises to avoid console spam
});
