// script.js - VERSI LENGKAP DAN TERBARU

document.addEventListener('DOMContentLoaded', () => {
    // === 1. DOM ELEMENTS ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    const audioStartBtn = document.getElementById('audioStartBtn'); // Mobile fix
    
    // Status / Message elements
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');

    // Main output container
    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    // Audio (MP3/WAV) related elements
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const waveformContainer = document.getElementById('waveform'); // Kontainer utama Wavesurfer
    
    // MIDI related elements
    const midiPlayer = document.getElementById('midiPlayer'); // Elemen <midi-player>
    const midiVisualizer = document.getElementById('midiVisualizer'); // Elemen <midi-visualizer>
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // Backend URL - Auto-detect local vs production (Pinggy)
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link'  // Ganti jika URL Pinggy Anda berubah
        : 'http://localhost:5000';  // Local Flask development

    let wavesurferInstance = null; // Instans Wavesurfer
    let audioContextReady = false; // Status AudioContext

    console.log('App starting... Backend URL:', BACKEND_API_URL);
    console.log('MIDI Player element:', midiPlayer);
    console.log('Wavesurfer container:', waveformContainer);

    // === 2. HELPER FUNCTIONS ===
    
    // Fungsi untuk menginisialisasi atau melanjutkan AudioContext (fix auto-play policy)
    const initializeAudioContext = async () => {
        if (audioContextReady) return true; // Sudah diinisialisasi

        try {
            // Tone.js context (digunakan oleh html-midi-player secara internal)
            if (typeof Tone !== 'undefined' && Tone.context?.state !== 'running') {
                await Tone.start();
                console.log('✅ Tone.js AudioContext started/resumed');
            }
            
            // Web Audio API context standar (bisa untuk Wavesurfer WebAudio backend)
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
                console.log('✅ Web Audio API resumed');
            }
            
            // MIDI Player AudioContext (html-midi-player)
            // Note: html-midi-player secara internal akan resume contextnya
            // saat interaksi user atau jika Tone.start() sudah dipanggil.
            if (midiPlayer && midiPlayer.getContext && midiPlayer.getContext()?.state === 'suspended') {
                 await midiPlayer.getContext().resume();
                 console.log('✅ MIDI Player AudioContext resumed');
            }
            
            audioContextReady = true;
            if (audioStartBtn) audioStartBtn.classList.add('hidden'); // Sembunyikan tombol jika berhasil
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

    // Safe MIDI Player Controls (untuk visual piano roll, tanpa suara)
    const safeMidiControl = (action) => {
        if (!midiPlayer) {
            console.warn('MIDI Player element not found for action:', action);
            return;
        }

        try {
            switch (action) {
                case 'play':
                    // Jangan panggil midiPlayer.start() karena itu memutar suara
                    // Kita hanya ingin visualnya berjalan, yang sudah dihandle oleh midiPlayer.paused = false
                    console.log('▶️ MIDI Play (visual only) triggered.');
                    break;
                    
                case 'pause':
                    if (midiPlayer.paused === false) { 
                        midiPlayer.paused = true; // Jeda visual piano roll
                    }
                    console.log('⏸️ MIDI Pause triggered (visual only).');
                    break;
                    
                case 'stop':
                    midiPlayer.currentTime = 0; // Reset posisi
                    midiPlayer.paused = true; // Jeda visual
                    console.log('⏹️ MIDI Stop triggered.');
                    break;
                    
                case 'reset':
                    safeMidiControl('stop');
                    midiPlayer.src = ''; // Hapus sumber MIDI
                    midiVisualizer.src = ''; // Hapus sumber visualizer
                    midiPlayer.removeAttribute('src'); // Hapus atribut src
                    midiVisualizer.removeAttribute('src'); // Hapus atribut src
                    midiPlayer.style.opacity = '0.5'; // Visually disable it
                    console.log('🔄 MIDI Player reset.');
                    break;
            }
        } catch (error) {
            console.error(`❌ MIDI Control error (${action}):`, error);
        }
    };

    // Inisialisasi atau memperbarui Wavesurfer
    const initOrUpdateWavesurfer = () => {
        // Hancurkan instance lama Wavesurfer jika ada
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
        // Pastikan kontainer waveform, AudioContext, dan audioPlayer tersedia
        if (!waveformContainer || !audioContextReady || !audioPlayer) {
            console.warn('Wavesurfer init skipped - container/audio not ready or audioPlayer not found.');
            return;
        }

        try {
            const plugins = [];
            // Tambahkan plugin Minimap jika tersedia (dari CDN)
            if (typeof WaveSurfer.minimap !== 'undefined') {
                plugins.push(
                    WaveSurfer.minimap.create({
                        height: 30,
                        waveColor: '#ddd',
                        progressColor: '#999',
                        container: '#waveform-minimap'
                    })
                );
                console.log('✅ Wavesurfer Minimap plugin loaded.');
            } else {
                console.warn('⚠️ Wavesurfer Minimap plugin NOT found (via type check).');
            }

            // Tambahkan plugin Timeline jika tersedia (dari CDN)
            if (typeof WaveSurfer.timeline !== 'undefined') {
                plugins.push(
                    WaveSurfer.timeline.create({
                        container: '#waveform-timeline',
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
                backend: 'WebAudio', // Lebih baik untuk sinkronisasi
                media: audioPlayer,  // PENTING: Sambungkan langsung ke elemen HTML audio
                plugins: plugins
            });

            // Event listeners untuk sinkronisasi playback antara Wavesurfer dan HTML audio element
            wavesurferInstance.on('play', () => {
                if (audioPlayer.paused) audioPlayer.play().catch(e => console.warn('Audio play failed:', e));
                midiPlayer.paused = false; // Pastikan MIDI visual maju
            });
            wavesurferInstance.on('pause', () => {
                if (!audioPlayer.paused) audioPlayer.pause();
                midiPlayer.paused = true; // Jeda MIDI visual
            });
            
            // Jika audioPlayer yang memicu play/pause/seek
            audioPlayer.addEventListener('play', () => {
                if (!wavesurferInstance.isPlaying()) wavesurferInstance.play();
                midiPlayer.paused = false; // Pastikan MIDI visual maju
            });
            audioPlayer.addEventListener('pause', () => {
                if (wavesurferInstance.isPlaying()) wavesurferInstance.pause();
                midiPlayer.paused = true; // Jeda MIDI visual
            });
            audioPlayer.addEventListener('seeking', () => { // Saat audioPlayer di-seek
                if (audioPlayer.duration && wavesurferInstance) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
                if (midiPlayer) {
                    midiPlayer.currentTime = audioPlayer.currentTime; // Sinkronkan MIDI
                    midiPlayer.paused = true; // Jeda MIDI visual saat seeking
                }
            });
            audioPlayer.addEventListener('seeked', () => { // Setelah audioPlayer selesai di-seek
                if (audioPlayer.duration && wavesurferInstance) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                }
                if (midiPlayer) {
                    midiPlayer.currentTime = audioPlayer.currentTime; // Sinkronkan MIDI
                    midiPlayer.paused = audioPlayer.paused; // Lanjutkan play/pause sesuai audioPlayer
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

    // Fungsi untuk menyembunyikan semua pesan status dan output, serta mereset player
    const hideAllOutput = () => {
        console.log('🔄 Resetting all outputs...');
        
        loadingDiv?.classList.add('hidden');
        resultDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        musicOutputDiv?.classList.add('hidden');
        errorMessageSpan.textContent = '';

        // Reset audio player safely
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

        // Reset MIDI player safely (visual only)
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

    // Validasi elemen DOM
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
        console.log('✅ All DOM elements found.');
        return true;
    };

    // === 3. EVENT LISTENERS ===
    
    // Listener untuk slider Tempo
    if (tempoSlider) {
        tempoSlider.addEventListener('input', () => {
            tempoValueSpan.textContent = tempoSlider.value === "0" ? "Auto" : tempoSlider.value;
        });
    }

    // Listener untuk tombol "Mulai Audio" (mobile fix)
    if (audioStartBtn) {
        audioStartBtn.addEventListener('click', async () => {
            const success = await initializeAudioContext();
            if (success) {
                audioStartBtn.classList.add('hidden');
                // Re-init Wavesurfer setelah AudioContext siap
                initOrUpdateWavesurfer(); 
            }
        });
    }

    // Listener untuk html-midi-player (visual saja)
    if (midiPlayer) {
        // Log event penting dari midi-player
        midiPlayer.addEventListener('loadstart', () => console.log('⏳ MIDI loading started'));
        midiPlayer.addEventListener('load', () => {
            midiPlayer.style.opacity = '1'; // Aktifkan secara visual
            console.log('✅ MIDI loaded and ready for visual playback.');
        });
        midiPlayer.addEventListener('error', (e) => {
            console.error('❌ MIDI load error:', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau format.';
            errorDiv.classList.remove('hidden');
        });
        midiPlayer.addEventListener('end', () => {
            console.log('🎵 MIDI visual playback ended.');
            safeMidiControl('stop'); // Reset visual
        });
    }

    // === 4. Listener Utama untuk Tombol "Generate Instrumental" ===
    if (generateBtn && validateDOM()) {
        generateBtn.addEventListener('click', async () => {
            // Pastikan AudioContext sudah siap sebelum generate
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

            hideAllOutput(); // Sembunyikan semua output lama
            loadingDiv.classList.remove('hidden'); // Tampilkan loading
            generateBtn.disabled = true; // Nonaktifkan tombol
            generateBtn.textContent = 'Membuat...';
            generateBtn.classList.add('opacity-50');

            try {
                console.log('🚀 Starting generation request...');
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
                    } catch (e) {
                        console.error("Failed to parse error JSON:", e);
                    }
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                console.log('✅ Response received from backend:', data);

                const audioUrl = data.wav_url || data.mp3_url; // Backend Anda sekarang mengembalikan MP3 sebagai wav_url
                const midiUrl = data.midi_url;

                if (!audioUrl || !midiUrl) {
                    throw new Error('File audio/MIDI tidak lengkap dari server.');
                }

                // Fungsi helper untuk membangun URL lengkap (penting untuk Pinggy/local dev)
                const getFullUrl = (relativePath) => {
                    if (relativePath.startsWith('http')) return relativePath; // Sudah absolute
                    const base = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
                    return `${base}${path}`;
                };

                const fullAudioUrl = getFullUrl(audioUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('🔗 Full URLs - Audio:', fullAudioUrl, 'MIDI:', fullMidiUrl);

                // --- 1. Muat Audio (MP3/WAV) ke elemen HTML audio ---
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load(); // Penting untuk memuat sumber baru
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';
                
                // --- 2. Muat MIDI ke html-midi-player (untuk visual saja) ---
                midiPlayer.src = fullMidiUrl;
                midiVisualizer.src = fullMidiUrl;
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';
                midiPlayer.style.opacity = '1'; // Pastikan terlihat aktif secara visual

                // --- 3. Inisialisasi/Muat Wavesurfer ---
                // Delay sedikit untuk stabilitas, memastikan audioPlayer.src sudah diatur
                setTimeout(() => {
                    initOrUpdateWavesurfer(); // Pastikan Wavesurfer di-init dengan `media: audioPlayer`
                    if (wavesurferInstance) {
                        wavesurferInstance.load(audioPlayer); // PENTING: Muat dari elemen audioPlayer
                    }
                }, 200);

                // Tampilkan seluruh area output musik
                musicOutputDiv.classList.remove('hidden');
                resultDiv.classList.remove('hidden');
                console.log('🎉 Generation complete! Audio and MIDI loaded.');

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

    // === 5. Initial setup saat DOM selesai dimuat ===
    initializeAudioContext().then(() => {
        // Init Wavesurfer setelah AudioContext siap
        initOrUpdateWavesurfer(); 
        safeMidiControl('reset'); // Pastikan MIDI player dalam kondisi reset visual
        console.log('🎵 App ready! AudioContext:', audioContextReady);
    });

    // === 6. Page visibility handler (jeda audio saat tab tidak aktif) ===
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            safeMidiControl('pause'); // Jeda visual MIDI
            wavesurferInstance?.pause();
        }
    });

    // === 7. Global error handler (tangkap error JavaScript yang tidak terduga) ===
    window.addEventListener('error', (e) => {
        console.error('🌐 Global error caught:', e.error?.message || e.message);
        // Tampilkan pesan error global jika belum ada error spesifik
        if (errorDiv && errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent = `Global Error: ${e.error?.message || e.message}`;
            errorDiv.classList.remove('hidden');
        }
    });

    // Debug: Log MIDI API availability (saat startup)
    if (midiPlayer) {
        console.log('MIDI Player API check (on startup):');
        console.log('- midiPlayer.start method:', !!midiPlayer.start);
        console.log('- midiPlayer.pause property:', typeof midiPlayer.paused !== 'undefined');
        console.log('- midiPlayer.stop method:', !!midiPlayer.stop);
        console.log('- midiPlayer.currentTime property:', typeof midiPlayer.currentTime !== 'undefined');
    }
});
