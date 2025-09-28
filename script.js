// script.js - VERSI TERBARU DAN TERBAIK

document.addEventListener('DOMContentLoaded', () => {
    // === 1. DOM ELEMENTS ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    const audioStartBtn = document.getElementById('audioStartBtn');
    
    // Status elements
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');
    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    // Audio elements
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const waveformContainer = document.getElementById('waveform');
    
    // MIDI elements
    const midiPlayer = document.getElementById('midiPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // Backend URL - Auto-detect local vs production
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link' // Ganti jika URL Pinggy Anda berubah
        : 'http://localhost:5000';

    let wavesurferInstance = null;
    let audioContextReady = false;

    console.log('App starting... Backend URL:', BACKEND_API_URL);
    console.log('MIDI Player element:', midiPlayer);
    console.log('Wavesurfer container:', waveformContainer);

    // === 2. HELPER FUNCTIONS ===

    // Initialize AudioContext (fix AudioContext errors)
    const initializeAudioContext = async () => {
        if (audioContextReady) return true; // Already initialized

        try {
            // Tone.js (if available)
            if (typeof Tone !== 'undefined' && Tone.context?.state !== 'running') {
                await Tone.start();
                console.log('✅ Tone.js AudioContext started');
            }
            
            // HTML5 Audio context
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
                console.log('✅ Web Audio API resumed');
            }
            
            // MIDI Player AudioContext (html-midi-player specific)
            // html-midi-player harus punya metode getContext()
            if (midiPlayer && midiPlayer.getContext && midiPlayer.getContext()?.state === 'suspended') {
                await midiPlayer.getContext().resume();
                console.log('✅ MIDI Player AudioContext resumed');
            }
            
            audioContextReady = true;
            if (audioStartBtn) audioStartBtn.classList.add('hidden');
            return true;
        } catch (error) {
            console.error('❌ AudioContext init failed:', error);
            if (audioStartBtn) {
                audioStartBtn.textContent = 'Audio Error - Coba Lagi';
                audioStartBtn.classList.remove('hidden');
            }
            return false;
        }
    };

    // FIXED: Safe MIDI Player Controls
    const safeMidiControl = (action) => {
        if (!midiPlayer) {
            console.warn('MIDI Player element not found for action:', action);
            return;
        }

        try {
            switch (action) {
                case 'play':
                    if (midiPlayer.start) {
                        midiPlayer.start();
                    } else if (midiPlayer.shadowRoot) { // Check for shadowRoot
                        const playBtn = midiPlayer.shadowRoot.querySelector('button[title="Play"], .play-button');
                        if (playBtn) playBtn.click();
                    }
                    console.log('▶️ MIDI Play triggered');
                    break;
                    
                case 'pause':
                    if (midiPlayer.paused === false) { // Only pause if it's currently playing
                        midiPlayer.paused = true;
                        if (midiPlayer.shadowRoot) { // Check for shadowRoot
                            const pauseBtn = midiPlayer.shadowRoot.querySelector('button[title="Pause"], .pause-button');
                            if (pauseBtn) pauseBtn.click(); // Trigger button click as fallback/redundancy
                        }
                    }
                    console.log('⏸️ MIDI Pause triggered (safe mode)');
                    break;
                    
                case 'stop':
                    // html-midi-player does not have a direct .stop()
                    // reset currentTime and then pause
                    midiPlayer.currentTime = 0;
                    safeMidiControl('pause');
                    console.log('⏹️ MIDI Stop triggered');
                    break;
                    
                case 'reset':
                    safeMidiControl('stop');
                    midiPlayer.src = ''; // Clear src attribute
                    midiVisualizer.src = ''; // Clear src attribute
                    midiPlayer.removeAttribute('src'); // Clear src attribute
                    midiVisualizer.removeAttribute('src'); // Clear src attribute
                    midiPlayer.style.opacity = '0.5'; // Keep it disabled visually
                    console.log('🔄 MIDI Player reset');
                    break;
            }
        } catch (error) {
            console.error(`❌ MIDI Control error (${action}):`, error);
        }
    };

    // FIXED: Wavesurfer Init with Minimap & Timeline (using CDN-loaded plugins)
    const initOrUpdateWavesurfer = () => {
        // Destroy existing instance BEFORE creating a new one
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
        if (!waveformContainer || !audioContextReady) {
            console.warn('Wavesurfer skipped - container/audio not ready');
            return;
        }

        try {
            const plugins = [];
            // Add Minimap plugin if available
            if (typeof WaveSurfer.minimap !== 'undefined') {
                plugins.push(
                    WaveSurfer.minimap.create({
                        height: 30,
                        waveColor: '#ddd',
                        progressColor: '#999',
                        container: '#waveform-minimap' // Pastikan #waveform-minimap ada di HTML
                    })
                );
                console.log('✅ Wavesurfer Minimap plugin loaded.');
            } else {
                console.warn('⚠️ Wavesurfer Minimap plugin NOT found (via type check).');
            }

            // Add Timeline plugin if available
            if (typeof WaveSurfer.timeline !== 'undefined') {
                plugins.push(
                    WaveSurfer.timeline.create({
                        container: '#waveform-timeline', // Pastikan #waveform-timeline ada di HTML
                        timeInterval: 0.5,
                        height: 20,
                        primaryFontColor: '#000'
                    })
                );
                console.log('✅ Wavesurfer Timeline plugin loaded.');
            } else {
                console.warn('⚠️ Wavesurfer Timeline plugin NOT found (via type check).');
            }

            wavesurferInstance = WaveSurfer.create({
                container: waveformContainer,
                waveColor: '#a0f0ff',
                progressColor: '#ffd700',
                cursorColor: '#ff00ff',
                barWidth: 3,
                height: 120,
                responsive: true,
                hideScrollbar: true,
                interact: true,
                backend: 'WebAudio', // Better for sync
                plugins: plugins // Gunakan array plugins yang sudah diisi
            });

            // Sync with HTML audio player
            if (audioPlayer) {
                wavesurferInstance.on('play', () => audioPlayer.play().catch(e => console.warn('Audio play failed:', e)));
                wavesurferInstance.on('pause', () => audioPlayer.pause());
                
                audioPlayer.addEventListener('play', () => {
                    if (wavesurferInstance) wavesurferInstance.play();
                });
                audioPlayer.addEventListener('pause', () => {
                    if (wavesurferInstance) wavesurferInstance.pause();
                });
                audioPlayer.addEventListener('timeupdate', () => {
                    if (wavesurferInstance && audioPlayer.duration) {
                        wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                    }
                });
                audioPlayer.addEventListener('seeked', () => {
                    if (wavesurferInstance && audioPlayer.duration) {
                        wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                    }
                });

                // Error handling untuk audio HTML
                audioPlayer.addEventListener('error', (e) => {
                    console.error('Audio load error:', e);
                    errorMessageSpan.textContent = 'Gagal memuat file audio. Periksa URL atau format file.';
                    errorDiv.classList.remove('hidden');
                });
            }

            console.log('✅ Wavesurfer core initialized successfully');
        } catch (error) {
            console.error('❌ Wavesurfer init failed:', error);
            // Fallback UI
            waveformContainer.innerHTML = `
                <div class="p-4 text-center text-red-500 bg-red-50 rounded">
                    <p>Waveform gagal dimuat 😞</p>
                    <p class="text-sm mt-1">Error: ${error.message}. Coba refresh.</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Refresh</button>
                </div>
            `;
        }
    };

    // FIXED: Safe Reset Function
    const hideAllOutput = () => {
        console.log('🔄 Resetting all outputs...');
        
        loadingDiv?.classList.add('hidden');
        resultDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        musicOutputDiv?.classList.add('hidden');
        errorMessageSpan.textContent = '';

        // Reset audio safely
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
            audioPlayer.load(); // Penting untuk mengosongkan sumber
        }
        if (downloadLink) {
            downloadLink.removeAttribute('href');
            downloadLink.removeAttribute('download');
        }

        // FIXED: Reset MIDI safely (using safeMidiControl)
        safeMidiControl('reset');
        
        if (downloadMidiLink) {
            downloadMidiLink.removeAttribute('href');
            downloadMidiLink.removeAttribute('download');
        }

        // Reset Wavesurfer
        if (wavesurferInstance) {
            wavesurferInstance.destroy(); // Gunakan destroy untuk membersihkan semua event/DOM
            wavesurferInstance = null;
        }

        console.log('✅ All outputs reset');
    };

    // Validate DOM (existing)
    const validateDOM = () => {
        const required = {
            lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn,
            loadingDiv, resultDiv, errorDiv, errorMessageSpan, musicOutputDiv,
            audioPlayer, downloadLink, waveformContainer, midiPlayer, midiVisualizer, downloadMidiLink
        };
        
        const missing = Object.entries(required).filter(([key, el]) => !el);
        if (missing.length > 0) {
            console.error('❌ Missing DOM elements:', missing.map(([k]) => k));
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Error: Halaman tidak lengkap';
                generateBtn.classList.add('bg-red-500', 'cursor-not-allowed');
            }
            return false;
        }
        console.log('✅ All DOM elements found');
        return true;
    };

    // === 3. EVENT LISTENERS ===

    // Tempo slider (existing)
    if (tempoSlider) {
        tempoSlider.addEventListener('input', () => {
            tempoValueSpan.textContent = tempoSlider.value === "0" ? "Auto" : tempoSlider.value;
        });
    }

    // Audio start button for mobile (existing)
    if (audioStartBtn) {
        audioStartBtn.addEventListener('click', async () => {
            const success = await initializeAudioContext();
            if (success) {
                audioStartBtn.classList.add('hidden');
                // Re-init Wavesurfer after audio ready
                initOrUpdateWavesurfer(); 
            }
        });
    }

    // FIXED: MIDI Player Event Listeners
    if (midiPlayer) {
        midiPlayer.addEventListener('loadstart', () => console.log('⏳ MIDI loading started'));
        midiPlayer.addEventListener('load', () => { // Gunakan 'load' bukan 'canplay' untuk html-midi-player
            midiPlayer.style.opacity = '1';
            console.log('✅ MIDI loaded and ready to play');
        });
        midiPlayer.addEventListener('error', (e) => {
            console.error('❌ MIDI load error:', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau format.';
            errorDiv.classList.remove('hidden');
        });
        midiPlayer.addEventListener('end', () => { // Gunakan 'end' bukan 'ended'
            console.log('🎵 MIDI playback ended');
            safeMidiControl('stop');
        });

        // Sync audioPlayer play/pause with midiPlayer
        audioPlayer.addEventListener('play', () => safeMidiControl('play'));
        audioPlayer.addEventListener('pause', () => safeMidiControl('pause'));
    }

    // Main Generate Button
    if (generateBtn && validateDOM()) {
        generateBtn.addEventListener('click', async () => {
            if (!audioContextReady) {
                const success = await initializeAudioContext();
                if (!success) {
                    errorMessageSpan.textContent = 'Gagal memulai audio. Klik "Mulai Audio" dulu.';
                    errorDiv.classList.remove('hidden');
                    return;
                }
            }

            const lyrics = lyricsInput.value.trim();
            const selectedGenre = genreSelect.value;
            const selectedTempo = tempoSlider.value === "0" ? "auto" : parseInt(tempoSlider.value);

            if (!lyrics) {
                hideAllOutput();
                errorMessageSpan.textContent = 'Masukkan lirik dulu!';
                errorDiv.classList.remove('hidden');
                return;
            }

            hideAllOutput();
            loadingDiv.classList.remove('hidden');
            generateBtn.disabled = true;
            generateBtn.textContent = 'Membuat...';
            generateBtn.classList.add('opacity-50');

            try {
                console.log('🚀 Starting generation...');
                console.log('Payload:', { text: lyrics, genre: selectedGenre, tempo: selectedTempo });

                const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: lyrics, 
                        genre: selectedGenre, 
                        tempo: selectedTempo 
                    })
                });

                if (!response.ok) {
                    let errorMsg = `Server error: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                console.log('✅ Response received:', data);

                const audioUrl = data.wav_url || data.mp3_url;
                const midiUrl = data.midi_url;

                if (!audioUrl || !midiUrl) {
                    throw new Error('File audio/MIDI tidak lengkap dari server.');
                }

                // Build full URLs
                const getFullUrl = (url) => {
                    if (url.startsWith('http')) return url;
                    const base = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                    // Pastikan path tidak double slash jika url sudah diawali slash
                    return `${base}${url.startsWith('/') ? url : '/' + url}`;
                };

                const fullAudioUrl = getFullUrl(audioUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('🔗 Full URLs - Audio:', fullAudioUrl, 'MIDI:', fullMidiUrl);

                // Load Audio
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load();
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';
                
                // Load MIDI (using safeMidiControl to ensure proper handling)
                midiPlayer.src = fullMidiUrl;
                midiVisualizer.src = fullMidiUrl;
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';
                // Trigger load event manually if needed, or rely on src attribute change
                // midiPlayer.load(); // Not a standard method, html-midi-player listens to src changes

                // Load Wavesurfer (with a slight delay for stability)
                setTimeout(() => {
                    initOrUpdateWavesurfer();
                    if (wavesurferInstance) {
                        wavesurferInstance.load(fullAudioUrl);
                    }
                }, 200);

                // Show results
                musicOutputDiv.classList.remove('hidden');
                resultDiv.classList.remove('hidden');
                console.log('🎉 Generation complete!');

            } catch (error) {
                console.error('❌ Generation failed:', error);
                
                let userMsg = error.message || 'Error tidak diketahui.';
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    userMsg = `Tidak bisa connect ke ${BACKEND_API_URL}. Cek: Flask running? Pinggy aktif?`;
                } else if (error.message.includes('NetworkError')) {
                    userMsg = 'Koneksi gagal. Restart tunnel: ssh -R0:localhost:5000 a.pinggy.io';
                } else if (error.message.includes('mp3_file_path')) {
                    userMsg = 'Error backend: Konversi MP3 gagal. Periksa FFmpeg path dan SoundFont di Windows.';
                }
                
                errorMessageSpan.innerHTML = `<strong>${userMsg}</strong>`;
                errorDiv.classList.remove('hidden');
            } finally {
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Instrumental';
                generateBtn.classList.remove('opacity-50');
            }
        });
    }

    // Initial setup
    initializeAudioContext().then(() => {
        // Init Wavesurfer after AudioContext is ready
        initOrUpdateWavesurfer(); 
        safeMidiControl('reset');
        console.log('🎵 App ready! AudioContext:', audioContextReady);
    });

    // Page visibility handler (pause on tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            safeMidiControl('pause');
            wavesurferInstance?.pause();
        }
    });

    // Global error handler
    window.addEventListener('error', (e) => {
        console.error('🌐 Global error caught:', e.error?.message || e.message);
        // Only show global error if no specific error is already displayed
        if (errorDiv && errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent = `Global Error: ${e.error?.message || e.message}`;
            errorDiv.classList.remove('hidden');
        }
    });
});
