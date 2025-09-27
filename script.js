// script.js - Versi Diperbaiki untuk generate-instrumental

document.addEventListener('DOMContentLoaded', () => {
    // === 1. DOM ELEMENTS ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    const audioStartBtn = document.getElementById('audioStartBtn'); // New for mobile
    
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

    // Backend URL - Tambah fallback untuk local dev
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link'  // Production (Pinggy)
        : 'http://localhost:5000';  // Local dev (Flask)

    let wavesurferInstance = null;
    let audioContextReady = false;  // Track AudioContext state

    // === 2. HELPER FUNCTIONS ===
    
    // Initialize AudioContext on user gesture (fix untuk semua browser)
    const initializeAudioContext = async () => {
        try {
            // Tone.js context
            if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
                await Tone.start();
                console.log('Tone.js AudioContext started');
            }
            
            // HTML5 Audio context (Chrome/Safari)
            if (audioPlayer && audioPlayer.getContext && audioPlayer.getContext().state === 'suspended') {
                await audioPlayer.getContext().resume();
                console.log('HTML5 AudioContext resumed');
            }
            
            // Firefox specific
            if (audioPlayer.mozAudioChannel?.context?.state === 'suspended') {
                await audioPlayer.mozAudioChannel.context.resume();
                console.log('Firefox AudioContext resumed');
            }
            
            audioContextReady = true;
            audioStartBtn?.classList.add('hidden');  // Hide button after init
            return true;
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            if (audioStartBtn) {
                audioStartBtn.textContent = 'Audio Error - Coba Lagi';
                audioStartBtn.classList.remove('hidden');
            }
            return false;
        }
    };

    // Improved Wavesurfer init with better error handling
    const initOrUpdateWavesurfer = () => {
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
        if (!waveformContainer || !audioPlayer || !audioContextReady) {
            console.warn('Wavesurfer init skipped - missing elements or audio not ready');
            return;
        }

        try {
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
                // Ganti backend ke Web Audio untuk sync lebih baik
                backend: 'WebAudio',  // Better sync than MediaElement
                // Tambah error handling
                plugins: [
                    WaveSurfer.minimap.create(),
                    WaveSurfer.timeline.create({
                        container: '#waveform-timeline'  // Optional timeline
                    })
                ]
            });

            // Sync dengan audio player
            wavesurferInstance.on('play', () => audioPlayer.play());
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

            console.log('Wavesurfer initialized successfully');
        } catch (error) {
            console.error('Wavesurfer init failed:', error);
            // Fallback: tampilkan pesan error di waveform container
            waveformContainer.innerHTML = '<p class="text-red-500 text-center p-2">Waveform gagal dimuat. Coba refresh halaman.</p>';
        }
    };

    // Reset all outputs safely
    const hideAllOutput = () => {
        loadingDiv?.classList.add('hidden');
        resultDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        musicOutputDiv?.classList.add('hidden');
        errorMessageSpan.textContent = '';

        // Reset audio
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
        }
        downloadLink.removeAttribute('href');
        downloadLink.removeAttribute('download');

        // Reset MIDI safely
        if (midiPlayer) {
            midiPlayer.pause();
            midiPlayer.currentTime = 0;
            midiPlayer.src = '';
            // Jangan disable - biarkan ready
            midiPlayer.style.opacity = '0.5';  // Visual feedback
        }
        if (midiVisualizer) {
            midiVisualizer.src = '';
            midiVisualizer.currentTime = 0;
        }
        downloadMidiLink.removeAttribute('href');
        downloadMidiLink.removeAttribute('download');

        // Reset Wavesurfer
        if (wavesurferInstance) {
            wavesurferInstance.stop();
            wavesurferInstance.empty();
        }
    };

    // Validate DOM elements with better error reporting
    const validateDOM = () => {
        const required = {
            lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn,
            loadingDiv, resultDiv, errorDiv, errorMessageSpan, musicOutputDiv,
            audioPlayer, downloadLink, waveformContainer, midiPlayer, midiVisualizer, downloadMidiLink
        };
        
        const missing = Object.entries(required).filter(([key, el]) => !el);
        if (missing.length > 0) {
            console.error('Missing DOM elements:', missing.map(([k]) => k));
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Error: Halaman tidak lengkap';
                generateBtn.classList.add('bg-red-500', 'cursor-not-allowed');
            }
            return false;
        }
        return true;
    };

    // === 3. EVENT LISTENERS ===
    
    // Tempo slider
    if (tempoSlider) {
        tempoSlider.addEventListener('input', () => {
            tempoValueSpan.textContent = tempoSlider.value === "0" ? "Auto" : tempoSlider.value;
        });
    }

    // Audio start button (mobile fix)
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

    // Main generate button - dengan improved audio handling
    if (generateBtn && validateDOM()) {
        generateBtn.addEventListener('click', async () => {
            // Pastikan audio context ready
            if (!audioContextReady) {
                const success = await initializeAudioContext();
                if (!success) {
                    errorMessageSpan.textContent = 'Gagal memulai audio. Coba klik "Mulai Audio" terlebih dahulu.';
                    errorDiv.classList.remove('hidden');
                    return;
                }
            }

            const lyrics = lyricsInput.value.trim();
            const selectedGenre = genreSelect.value;
            const selectedTempo = tempoSlider.value === "0" ? "auto" : parseInt(tempoSlider.value);

            if (!lyrics) {
                hideAllOutput();
                errorMessageSpan.textContent = 'Mohon masukkan lirik untuk membuat instrumental!';
                errorDiv.classList.remove('hidden');
                return;
            }

            hideAllOutput();
            loadingDiv.classList.remove('hidden');
            generateBtn.disabled = true;
            generateBtn.textContent = 'Membuat Instrumental...';
            generateBtn.classList.add('opacity-50');

            try {
                console.log('=== GENERATE REQUEST ===');
                console.log('URL:', BACKEND_API_URL);
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

                console.log('Response status:', response.status, 'OK:', response.ok);

                if (!response.ok) {
                    let errorMsg = `Server error: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        console.error('Backend error:', errorData);
                        errorMsg = errorData.error || errorMsg;
                        // Handle specific backend errors
                        if (errorData.error?.includes('mp3_file_path')) {
                            errorMsg = 'Error konversi audio (MP3). Periksa FFmpeg dan SoundFont.';
                        }
                    } catch (e) {
                        console.error('Failed to parse error JSON:', e);
                    }
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                console.log('=== SUCCESS ===', data);

                const wavUrl = data.wav_url || data.mp3_url;  // Handle both formats
                const midiUrl = data.midi_url;

                if (!wavUrl || !midiUrl) {
                    throw new Error('Backend tidak mengembalikan file audio/MIDI lengkap.');
                }

                // Build full URLs (handle relative/absolute)
                const getFullUrl = (url) => {
                    if (url.startsWith('http')) return url;  // Already absolute
                    const base = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                    const path = url.startsWith('/') ? url : `/${url}`;
                    return `${base}${path}`;
                };

                const fullWavUrl = getFullUrl(wavUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('Full URLs - WAV:', fullWavUrl, 'MIDI:', fullMidiUrl);

                // Load audio
                audioPlayer.src = fullWavUrl;
                audioPlayer.load();
                
                // Set download links
                downloadLink.href = fullWavUrl;
                downloadLink.download = fullWavUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';
                
                // Load MIDI
                if (midiPlayer) {
                    midiPlayer.src = fullMidiUrl;
                    midiPlayer.style.opacity = '1';  // Enable visual
                    console.log('MIDI loaded');
                }
                if (midiVisualizer) {
                    midiVisualizer.src = fullMidiUrl;
                }
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';

                // Load waveform (after audio context ready)
                setTimeout(() => {
                    if (wavesurferInstance) {
                        wavesurferInstance.load(fullWavUrl);
                    } else {
                        initOrUpdateWavesurfer();
                        if (wavesurferInstance) wavesurferInstance.load(fullWavUrl);
                    }
                }, 100);

                // Show results
                musicOutputDiv.classList.remove('hidden');
                resultDiv.classList.remove('hidden');
                console.log('=== GENERATION COMPLETE ===');

            } catch (error) {
                console.error('=== GENERATION ERROR ===', error);
                
                let userMessage = error.message || 'Terjadi kesalahan tidak diketahui.';
                
                // Better error messages
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    userMessage = 'Tidak bisa terhubung ke server. Periksa: 1) Backend Flask running? 2) Pinggy tunnel aktif? 3) CORS enabled?';
                } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                    userMessage = `Koneksi gagal ke ${BACKEND_API_URL}. Cek tunnel Pinggy atau jalankan lokal (python app.py).`;
                } else if (error.message.includes('mp3_file_path')) {
                    userMessage = 'Error backend: Konversi MP3 gagal. Periksa FFmpeg path dan SoundFont di Windows.';
                }
                
                errorMessageSpan.textContent = userMessage;
                errorDiv.classList.remove('hidden');
                
                // Network debugging
                if (error.name === 'TypeError') {
                    console.error('Network troubleshooting:');
                    console.error('- URL:', `${BACKEND_API_URL}/generate-instrumental`);
                    console.error('- Local dev? Try: http://localhost:5000');
                    console.error('- CORS? Add flask-cors to backend');
                    console.error('- Tunnel down? Restart: ssh -R0:localhost:5000 a.pinggy.io');
                }
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
        initOrUpdateWavesurfer();
        console.log('App initialized. Backend URL:', BACKEND_API_URL);
    });

    // Handle page visibility (pause audio when tab hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer.pause();
            if (midiPlayer) midiPlayer.pause();
            if (wavesurferInstance) wavesurferInstance.pause();
        }
    });

    // Error boundary untuk unhandled errors
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
        if (errorDiv && !errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent += `\nDetail: ${e.error.message}`;
        }
    });
});
