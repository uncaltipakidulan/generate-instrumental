// script.js - FIXED VERSION untuk generate-instrumental
// Fix: midiPlayer.pause() error & Wavesurfer.minimap undefined

document.addEventListener('DOMContentLoaded', () => {
    // === 1. DOM ELEMENTS ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    const audioStartBtn = document.getElementById('audioStartBtn'); // Mobile fix
    
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
    
    // MIDI elements - FIXED: Handle html-midi-player API correctly
    const midiPlayerContainer = document.getElementById('midiPlayerContainer');
    const midiPlayer = document.getElementById('midiPlayer');  // <midi-player> element
    const midiVisualizer = document.getElementById('midiVisualizer');  // <midi-visualizer>
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // Backend URL - Auto-detect local vs production
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link'  // Pinggy tunnel
        : 'http://localhost:5000';  // Local Flask

    let wavesurferInstance = null;
    let audioContextReady = false;
    let midiPlayerReady = false;  // Track MIDI player state

    console.log('App starting... Backend URL:', BACKEND_API_URL);
    console.log('MIDI Player element:', midiPlayer);
    console.log('Wavesurfer container:', waveformContainer);

    // === 2. HELPER FUNCTIONS ===

    // Initialize AudioContext (fix AudioContext errors)
    const initializeAudioContext = async () => {
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
            if (midiPlayer && midiPlayer.getContext?.()?.state === 'suspended') {
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

    // FIXED: Safe MIDI Player Controls (no .pause() method)
    const safeMidiControl = (action) => {
        if (!midiPlayer) {
            console.warn('MIDI Player element not found');
            return;
        }

        try {
            switch (action) {
                case 'play':
                    if (midiPlayer.play) {
                        midiPlayer.play();
                    } else {
                        // Fallback: Trigger click on play button inside midi-player
                        const playBtn = midiPlayer.querySelector('button[title="Play"], .play-button');
                        if (playBtn) playBtn.click();
                    }
                    console.log('▶️ MIDI Play triggered');
                    break;
                    
                case 'pause':
                    // html-midi-player doesn't have .pause() - use event or property
                    if (midiPlayer.pause) {
                        midiPlayer.pause();  // Try if available in newer versions
                    } else if (midiPlayer.paused === false) {
                        // Set paused property or trigger pause button
                        midiPlayer.paused = true;
                        const pauseBtn = midiPlayer.querySelector('button[title="Pause"], .pause-button');
                        if (pauseBtn) pauseBtn.click();
                    }
                    console.log('⏸️ MIDI Pause triggered (safe mode)');
                    break;
                    
                case 'stop':
                    if (midiPlayer.stop) {
                        midiPlayer.stop();
                    } else {
                        midiPlayer.currentTime = 0;  // Reset position
                        safeMidiControl('pause');
                    }
                    console.log('⏹️ MIDI Stop triggered');
                    break;
                    
                case 'load':
                    midiPlayerReady = false;
                    console.log('⏳ MIDI loading...');
                    midiPlayer.addEventListener('load', () => {
                        midiPlayerReady = true;
                        console.log('✅ MIDI Player loaded and ready');
                    }, { once: true });
                    break;
                    
                case 'reset':
                    safeMidiControl('stop');
                    if (midiPlayer.src) midiPlayer.src = '';
                    if (midiVisualizer) midiVisualizer.src = '';
                    midiPlayerReady = false;
                    console.log('🔄 MIDI Player reset');
                    break;
            }
        } catch (error) {
            console.error(`❌ MIDI Control error (${action}):`, error);
            // Fallback: Do nothing to prevent crash
        }
    };

    // FIXED: Wavesurfer Init with Minimap (handle undefined plugin)
    const initOrUpdateWavesurfer = () => {
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
        if (!waveformContainer || !audioContextReady) {
            console.warn('Wavesurfer skipped - container/audio not ready');
            return;
        }

        try {
            // Base Wavesurfer config
            const wavesurferConfig = {
                container: waveformContainer,
                waveColor: '#a0f0ff',
                progressColor: '#ffd700',
                cursorColor: '#ff00ff',
                barWidth: 3,
                height: 120,
                responsive: true,
                hideScrollbar: true,
                interact: true,
                backend: 'WebAudio',  // Better for sync
                plugins: []  // Start empty, add conditionally
            };

            // Check if Minimap plugin is available (fix "undefined")
            if (typeof WaveSurfer !== 'undefined' && WaveSurfer.minimap) {
                console.log('✅ Minimap plugin detected');
                wavesurferConfig.plugins.push(
                    WaveSurfer.minimap.create({
                        height: 30,
                        waveColor: '#ddd',
                        progressColor: '#999',
                        container: '#waveform-minimap'  // Optional separate container
                    })
                );
            } else {
                console.warn('⚠️ Minimap plugin not loaded - skipping');
                // Fallback: No minimap
            }

            // Check Timeline plugin
            if (typeof WaveSurfer !== 'undefined' && WaveSurfer.timeline) {
                console.log('✅ Timeline plugin detected');
                wavesurferConfig.plugins.push(
                    WaveSurfer.timeline.create({
                        container: '#waveform-timeline',  // Add <div id="waveform-timeline"></div> in HTML if needed
                        timeInterval: 0.5,
                        height: 10,
                        primaryFontColor: '#000'
                    })
                );
            }

            wavesurferInstance = WaveSurfer.create(wavesurferConfig);

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

                // Error handling
                audioPlayer.addEventListener('error', (e) => {
                    console.error('Audio load error:', e);
                    errorMessageSpan.textContent = 'Gagal memuat file audio. Periksa URL atau format file.';
                    errorDiv.classList.remove('hidden');
                });
            }

            console.log('✅ Wavesurfer initialized with plugins');
        } catch (error) {
            console.error('❌ Wavesurfer init failed:', error);
            // Fallback UI
            waveformContainer.innerHTML = `
                <div class="p-4 text-center text-red-500 bg-red-50 rounded">
                    <p>Waveform gagal dimuat 😞</p>
                    <p class="text-sm mt-1">Error: ${error.message}</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Refresh</button>
                </div>
            `;
        }
    };

    // FIXED: Safe Reset Function (no more midiPlayer.pause crash)
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
            audioPlayer.load();
        }
        if (downloadLink) {
            downloadLink.removeAttribute('href');
            downloadLink.removeAttribute('download');
        }

        // FIXED: Reset MIDI safely (no .pause() call)
        safeMidiControl('reset');  // Use safe method instead of direct .pause()
        
        if (downloadMidiLink) {
            downloadMidiLink.removeAttribute('href');
            downloadMidiLink.removeAttribute('download');
        }

        // Reset Wavesurfer
        if (wavesurferInstance) {
            wavesurferInstance.stop();
            wavesurferInstance.empty();
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
                initOrUpdateWavesurfer();  // Re-init after audio ready
            }
        });
    }

    // FIXED: MIDI Player Event Listeners (safe handling)
    if (midiPlayer) {
        // Listen for MIDI load events
        midiPlayer.addEventListener('loadstart', () => console.log('⏳ MIDI loading started'));
        midiPlayer.addEventListener('canplay', () => {
            midiPlayerReady = true;
            console.log('✅ MIDI can play');
        });
        midiPlayer.addEventListener('error', (e) => {
            console.error('❌ MIDI load error:', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau format.';
            errorDiv.classList.remove('hidden');
        });
        midiPlayer.addEventListener('ended', () => {
            console.log('🎵 MIDI playback ended');
            safeMidiControl('stop');
        });

        // Sync with audio player (optional)
        audioPlayer.addEventListener('play', () => safeMidiControl('play'));
        audioPlayer.addEventListener('pause', () => safeMidiControl('pause'));
    }

    // Main Generate Button (existing with MIDI/Wavesurfer fixes)
    if (generateBtn && validateDOM()) {
        generateBtn.addEventListener('click', async () => {
            // Ensure audio context ready
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
                    return `${base}/${url.startsWith('/') ? url.slice(1) : url}`;
                };

                const fullAudioUrl = getFullUrl(audioUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('🔗 Full URLs - Audio:', fullAudioUrl, 'MIDI:', fullMidiUrl);

                // Load Audio
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load();
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';

                // FIXED: Load MIDI safely
                safeMidiControl('load');
                if (midiPlayer) midiPlayer.src = fullMidiUrl;
                if (midiVisualizer) midiVisualizer.src = fullMidiUrl;
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';

                // FIXED: Load Wavesurfer (with delay for stability)
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
        initOrUpdateWavesurfer();
        safeMidiControl('reset');  // Ensure clean start
        console.log('🎵 App ready! AudioContext:', audioContextReady, 'MIDI Ready:', midiPlayerReady);
    });

    // Page visibility handler (pause on tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            safeMidiControl('pause');
            wavesurferInstance?.pause();
        }
    });

    // Global error handler (catch any remaining issues)
    window.addEventListener('error', (e) => {
        console.error('🌐 Global error:', e.error?.message || e.message);
        if (errorDiv && !errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent += `\nTech detail: ${e.error?.message || 'Unknown'}`;
        }
    });

    // Debug: Log MIDI API availability
    if (midiPlayer) {
        console.log('MIDI Player API check:');
        console.log('- play method:', !!midiPlayer.play);
        console.log('- pause method:', !!midiPlayer.pause);
        console.log('- stop method:', !!midiPlayer.stop);
        console.log('- currentTime:', typeof midiPlayer.currentTime);
    }
});
