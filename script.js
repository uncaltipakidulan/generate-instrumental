// script.js - VERSI LENGKAP & TERBAIK DENGAN SEMUA PERBAIKAN

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

    // Backend URL - Auto-detect local vs production (Pinggy)
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link' // PENTING: Ganti jika URL Pinggy Anda berubah
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

    // Safe MIDI Player Controls (for visual synchronization only)
    const safeMidiControl = (action) => {
        if (!midiPlayer) {
            console.warn('MIDI Player element not found for action:', action);
            return;
        }

        try {
            switch (action) {
                case 'play':
                    midiPlayer.paused = false; // Set properti paused ke false untuk play
                    console.log('▶️ MIDI Play triggered (visual sync only)');
                    break;
                    
                case 'pause':
                    midiPlayer.paused = true; // Set properti paused ke true untuk pause
                    console.log('⏸️ MIDI Pause triggered (safe mode)');
                    break;
                    
                case 'stop':
                    midiPlayer.currentTime = 0; // Reset waktu
                    midiPlayer.paused = true; // Set properti paused ke true untuk stop
                    console.log('⏹️ MIDI Stop triggered');
                    break;
                    
                case 'reset':
                    midiPlayer.currentTime = 0;
                    midiPlayer.paused = true; // Set properti paused ke true
                    midiPlayer.src = ''; 
                    midiVisualizer.src = ''; 
                    midiPlayer.removeAttribute('src'); 
                    midiVisualizer.removeAttribute('src'); 
                    midiPlayer.style.opacity = '0.5'; 
                    console.log('🔄 MIDI Player reset');
                    break;
            }
        } catch (error) {
            // Tangkap error jika properti 'paused' atau 'currentTime' belum tersedia
            console.error(`❌ MIDI Control error (${action}): ${error.message}. MIDI Player state may not be fully initialized.`, error);
            // Fallback: coba set ulang jika properti undefined
            if (midiPlayer.paused === undefined) {
                 console.warn("midiPlayer.paused is undefined. Retrying MIDI Player initialization state.");
                 midiPlayer.currentTime = 0;
                 midiPlayer.paused = true; // Coba set lagi
            }
        }
    };

    // Wavesurfer Init (TANPA PLUGIN Minimap & Timeline untuk menghindari error)
    const initOrUpdateWavesurfer = () => {
        // Destroy existing instance BEFORE creating a new one
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
        if (!waveformContainer || !audioContextReady || !audioPlayer) {
            console.warn('Wavesurfer skipped - container/audio not ready or audioPlayer not found.');
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
                backend: 'WebAudio',
                media: audioPlayer, // PENTING: Sambungkan langsung ke elemen HTML audio
                plugins: [] // KOSONGKAN ARRAY PLUGIN untuk menghindari error
            });

            // Event listeners untuk sync playback
            // Wavesurfer actions -> HTML Audio
            wavesurferInstance.on('play', () => audioPlayer.play().catch(e => console.warn('Audio play failed from Wavesurfer:', e)));
            wavesurferInstance.on('pause', () => audioPlayer.pause());
            wavesurferInstance.on('timeupdate', (progress) => { // Perbarui timeupdate agar Wavesurfer menggerakkan audio
                if (audioPlayer.duration) {
                    audioPlayer.currentTime = progress * audioPlayer.duration;
                }
            });

            // HTML Audio actions -> Wavesurfer
            audioPlayer.addEventListener('play', () => { 
                if (!wavesurferInstance.isPlaying()) wavesurferInstance.play(); 
                console.log('audioPlayer play event -> Wavesurfer play');
            });
            audioPlayer.addEventListener('pause', () => { 
                if (wavesurferInstance.isPlaying()) wavesurferInstance.pause(); 
                console.log('audioPlayer pause event -> Wavesurfer pause');
            });
            audioPlayer.addEventListener('seeked', () => {
                if (audioPlayer.duration && wavesurferInstance) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
            });
            audioPlayer.addEventListener('timeupdate', () => {
                if (wavesurferInstance && audioPlayer.duration) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
            });


            // Error handling untuk audio HTML
            audioPlayer.addEventListener('error', (e) => {
                console.error('Audio load error (from HTML Audio element):', e);
                errorMessageSpan.textContent = 'Gagal memuat file audio. Periksa URL atau format file.';
                errorDiv.classList.remove('hidden');
            });

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

    // Safe Reset Function
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

        // Reset MIDI safely (using safeMidiControl)
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
            }
        });
    }

    // MIDI Player Event Listeners (untuk visual saja)
    if (midiPlayer) {
        midiPlayer.addEventListener('load', () => { 
            midiPlayer.style.opacity = '1'; 
            console.log('✅ MIDI loaded and ready to play (visual).');
            // Setelah dimuat, jika audioPlayer sedang play, kita harus sync
            if (!audioPlayer.paused) {
                midiPlayer.paused = false; // Set ke false untuk play
                console.log('MIDI Player loaded, starting visual.');
            } else {
                midiPlayer.paused = true; // Set ke true untuk pause
                console.log('MIDI Player loaded, pausing visual.');
            }
        });

        midiPlayer.addEventListener('error', (e) => {
            console.error('❌ MIDI load error (from html-midi-player):', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau SoundFont.';
            errorDiv.classList.remove('hidden');
        });

        // Event listener untuk mengamati pemutaran MIDI secara internal (debug)
        midiPlayer.addEventListener('play', () => {
            console.log('🎵 MIDI Player internal PLAY event fired.');
        });
        midiPlayer.addEventListener('pause', () => {
            console.log('⏸️ MIDI Player internal PAUSE event fired.');
        });


        // Sinkronisasi visual midiPlayer dengan audioPlayer
        audioPlayer.addEventListener('play', () => {
            if (midiPlayer) {
                midiPlayer.paused = false; // PENTING: Playback MIDI (visual)
                console.log('🎵 Audio play event: MIDI visual starting.');
            }
        });
        audioPlayer.addEventListener('pause', () => {
            if (midiPlayer) {
                midiPlayer.paused = true; // PENTING: Jeda playback MIDI (visual)
                console.log('⏸️ Audio pause event: MIDI visual paused.');
            }
        });
        
        // Perbaikan untuk Seeking: Gunakan midiPlayer.currentTime dan paused
        audioPlayer.addEventListener('seeking', () => {
            if (midiPlayer && audioPlayer.duration) {
                midiPlayer.paused = true; // Jeda visual saat seeking
                midiPlayer.currentTime = audioPlayer.currentTime; // Sinkronkan waktu
                console.log(`🔄 Audio seeking event: MIDI visual seeking to ${audioPlayer.currentTime}.`);
            }
        });

        audioPlayer.addEventListener('seeked', () => {
            if (midiPlayer && audioPlayer.duration) {
                midiPlayer.currentTime = audioPlayer.currentTime; // Sinkronkan waktu
                if (!audioPlayer.paused) {
                    midiPlayer.paused = false; // Lanjutkan jika audioPlayer tidak dijeda
                    console.log('✅ Audio seeked event: MIDI visual resumed.');
                } else {
                    midiPlayer.paused = true; // Jeda jika audioPlayer dijeda
                    console.log('✅ Audio seeked event: MIDI visual paused after seek.');
                }
            }
        });

        // PENTING: Hapus atau komen event listener 'timeupdate' yang mengatur midiPlayer.currentTime
        // karena ini menyebabkan error "Start time must be strictly greater"
        // midiPlayer secara otomatis akan mengupdate currentTime-nya sendiri setelah midiPlayer.paused=false.
        // Pastikan blok ini dihilangkan/dikomentari dari script Anda!
        /*
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.paused === false && audioPlayer.duration && midiPlayer) {
                midiPlayer.currentTime = audioPlayer.currentTime;
            }
        });
        */
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

                // Load Audio ke HTML <audio> element
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load();
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';
                
                // Load MIDI (hanya visual, tanpa suara)
                if (midiPlayer) {
                    midiPlayer.src = fullMidiUrl;
                    midiPlayer.paused = true; // PENTING: Set ke true agar tidak langsung play
                    midiPlayer.style.opacity = '1'; // Pastikan terlihat
                }
                if (midiVisualizer) {
                    midiVisualizer.src = fullMidiUrl;
                }
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';

                // Load Wavesurfer (dengan slight delay untuk stabilitas)
                setTimeout(() => {
                    initOrUpdateWavesurfer(); // Inisialisasi/Update Wavesurfer
                    if (wavesurferInstance) {
                        wavesurferInstance.load(fullAudioUrl); // PENTING: Muat dari URL
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
                } else if (error.message.includes('pop from empty list')) { // Deteksi error dari backend
                    userMsg = 'Error internal server: Gagal memproses data musik (list kosong). Coba lirik berbeda.';
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
        // initOrUpdateWavesurfer(); // Wavesurfer diinisialisasi setelah generate, agar media: audioPlayer siap
        safeMidiControl('reset');
        console.log('🎵 App ready! AudioContext:', audioContextReady);
    });

    // Page visibility handler (pause on tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            if (midiPlayer) { // PENTING: Cek midiPlayer sebelum memanggil safeMidiControl
                safeMidiControl('pause'); 
            }
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
