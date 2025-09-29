// script.js - VERSI LENGKAP & TERBAIK DENGAN SEMUA PERBAIKAN DAN DEBUGGING

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
    const waveformContainer = document.getElementById('waveform'); // Kontainer utama untuk Wavesurfer
    
    // MIDI elements
    const midiPlayer = document.getElementById('midiPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // Backend URL - Auto-detect local vs production (Pinggy)
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link' // PENTING: Ganti jika URL Pinggy Anda berubah
        : 'http://localhost:5000'; // Gunakan localhost jika menjalankan dari server lokal

    let wavesurferInstance = null;
    let audioContextReady = false;
    let isMidiLoaded = false; // Track MIDI load state

    console.log('DEBUG: App starting... Backend URL:', BACKEND_API_URL);
    console.log('DEBUG: MIDI Player element:', midiPlayer);
    console.log('DEBUG: Wavesurfer container:', waveformContainer);

    // === 2. HELPER FUNCTIONS ===

    // Initialize AudioContext (fix mobile/first-load issues)
    const initializeAudioContext = async () => {
        if (audioContextReady) {
            console.log('DEBUG: AudioContext sudah siap.');
            return true;
        }

        try {
            // Tone.js (if available)
            if (typeof Tone !== 'undefined' && Tone.context?.state !== 'running') {
                console.log('DEBUG: Mencoba memulai Tone.js AudioContext...');
                await Tone.start();
                console.log('DEBUG: ✅ Tone.js AudioContext dimulai');
            }
            
            // HTML5 Audio context
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                console.log('DEBUG: ⏳ AudioContext HTML5 ditangguhkan. Mencoba resume...');
                await audioCtx.resume();
                console.log('DEBUG: ✅ AudioContext HTML5 diresume.');
            } else {
                console.log('DEBUG: ✅ AudioContext HTML5 sudah berjalan.');
            }
            
            // MIDI Player AudioContext (html-midi-player specific)
            if (midiPlayer && midiPlayer.getContext && midiPlayer.getContext()?.state === 'suspended') {
                console.log('DEBUG: ⏳ AudioContext MIDI Player ditangguhkan. Mencoba resume...');
                await midiPlayer.getContext().resume();
                console.log('DEBUG: ✅ AudioContext MIDI Player diresume.');
            } else if (midiPlayer && midiPlayer.getContext) { // Jika sudah berjalan
                console.log('DEBUG: ✅ AudioContext MIDI Player sudah berjalan.');
            }
            
            audioContextReady = true;
            if (audioStartBtn) {
                audioStartBtn.classList.add('hidden'); // Sembunyikan tombol setelah AudioContext siap
                console.log('DEBUG: Tombol Mulai Audio disembunyikan setelah AudioContext siap.');
            }
            console.log('DEBUG: initializeAudioContext berhasil. audioContextReady = true.');
            return true;
        } catch (error) {
            console.error('ERROR: ❌ initializeAudioContext gagal:', error);
            if (audioStartBtn) {
                audioStartBtn.textContent = 'Audio Error - Coba Lagi';
                audioStartBtn.classList.remove('hidden'); // Pastikan tombol terlihat jika ada error
            }
            return false;
        }
    };

    // Safe MIDI Control (avoid direct method calls)
    const safeMidiControl = (action) => {
        if (!midiPlayer) {
            console.warn('WARN: Pemutar MIDI element tidak ditemukan untuk aksi:', action);
            return;
        }
        // Jika belum dimuat dan aksinya bukan 'reset', keluar. 'reset' boleh dipanggil kapan saja.
        if (!isMidiLoaded && action !== 'reset') {
            console.warn('WARN: Pemutar MIDI belum siap untuk aksi:', action);
            return;
        }

        try {
            switch (action) {
                case 'reset':
                    if (midiPlayer.stop) midiPlayer.stop(); // Stop jika ada
                    midiPlayer.src = ''; // Clear src
                    if (midiVisualizer) midiVisualizer.src = ''; // Clear visualizer
                    midiPlayer.removeAttribute('src'); // Clear src attribute
                    if (midiVisualizer) midiVisualizer.removeAttribute('src'); // Clear src attribute
                    midiPlayer.style.opacity = '0.5'; // Keep it disabled visually
                    if (midiPlayer.currentTime) midiPlayer.currentTime = 0; // Reset waktu
                    isMidiLoaded = false;
                    console.log('DEBUG: 🔄 Pemutar MIDI direset');
                    break;
                case 'play':
                    if (midiPlayer.start) midiPlayer.start();
                    break;
                case 'pause':
                    if (midiPlayer.pause) midiPlayer.pause(); // html-midi-player memiliki pause
                    break;
                case 'stop':
                    if (midiPlayer.stop) midiPlayer.stop(); // html-midi-player memiliki stop
                    break;
                default:
                    console.warn(`WARN: Aksi MIDI kontrol tidak langsung ditangani: ${action}`);
                    break;
            }
        } catch (error) {
            console.error(`ERROR: ❌ Kesalahan Kontrol MIDI (${action}):`, error);
        }
    };

    // Wavesurfer Init with Minimap & Timeline (using CDN-loaded plugins)
    const initOrUpdateWavesurfer = () => {
        // Destroy existing instance BEFORE creating a new one
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
            console.log('DEBUG: Wavesurfer instance lama dihancurkan.');
        }
        
        if (!waveformContainer || !audioContextReady || !audioPlayer) {
            console.warn('WARN: Wavesurfer dilewati - container/audio tidak siap atau audioPlayer tidak ditemukan.');
            return;
        }

        // <<< PENANGANAN ERROR Wavesurfer.create IS NOT A FUNCTION DI SINI >>>
        // PENTING: Pastikan pustaka Wavesurfer.js utama sudah dimuat
        if (typeof WaveSurfer === 'undefined' || typeof WaveSurfer.create !== 'function') {
            console.error('ERROR: Wavesurfer.js belum dimuat atau WaveSurfer.create bukan fungsi.');
            waveformContainer.innerHTML = `
                <div class="p-4 text-center text-red-500 bg-red-50 rounded">
                    <p>Waveform gagal dimuat 😞</p>
                    <p class="text-sm mt-1">Error: Wavesurfer.js tidak ditemukan atau tidak siap. Mungkin masalah CDN atau urutan script. Coba refresh halaman.</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Refresh Halaman</button>
                </div>
            `;
            return; // Hentikan inisialisasi Wavesurfer
        }
        // <<< AKHIR PENANGANAN ERROR >>>

        try {
            const pluginsToLoad = [];
            // Add Minimap plugin if available
            // Note: Wavesurfer v7 plugin names are typically capitalized (e.g., WaveSurfer.Minimap)
            if (typeof WaveSurfer.Minimap !== 'undefined') { // Perhatikan huruf besar 'M'
                pluginsToLoad.push(
                    WaveSurfer.Minimap.create({
                        height: 30,
                        waveColor: '#ddd',
                        progressColor: '#999',
                        container: '#waveform-minimap' // Pastikan #waveform-minimap ada di HTML
                    })
                );
                console.log('DEBUG: ✅ Wavesurfer Minimap plugin siap.');
            } else {
                console.warn('WARN: ⚠️ Wavesurfer Minimap plugin NOT found (via type check).');
            }

            // Add Timeline plugin if available
            if (typeof WaveSurfer.Timeline !== 'undefined') { // Perhatikan huruf besar 'T'
                pluginsToLoad.push(
                    WaveSurfer.Timeline.create({
                        container: '#waveform-timeline', // Pastikan #waveform-timeline ada di HTML
                        timeInterval: 0.5,
                        primaryLabelInterval: 10,
                        secondaryLabelInterval: 5,
                        primaryColor: '#666',
                        secondaryColor: '#aaa',
                        unlabeledColor: '#eee',
                        fontFamily: 'Arial',
                        fontSize: 10,
                        height: 20,
                    })
                );
                console.log('DEBUG: ✅ Wavesurfer Timeline plugin siap.');
            } else {
                console.warn('WARN: ⚠️ Wavesurfer Timeline plugin NOT found (via type check).');
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
                // backend: 'WebAudio', // Ini sudah deprecated di v7, tapi mungkin masih bisa jalan. Tidak perlu diset eksplisit jika media diset.
                media: audioPlayer, // PENTING: Sambungkan langsung ke elemen HTML audio
                plugins: pluginsToLoad
            });

            // Event listeners untuk sync playback
            // Wavesurfer actions -> HTML Audio
            wavesurferInstance.on('play', () => {
                audioPlayer.play().catch(e => console.warn('WARN: Audio play failed from Wavesurfer:', e));
                console.log('DEBUG: Wavesurfer play event, memicu audioPlayer.play()');
            });
            wavesurferInstance.on('pause', () => {
                audioPlayer.pause();
                console.log('DEBUG: Wavesurfer pause event, memicu audioPlayer.pause()');
            });
            wavesurferInstance.on('decode', () => { // Event saat audio selesai di-decode
                console.log('DEBUG: Wavesurfer audio decoded. Ready for playback.');
            });
            wavesurferInstance.on('ready', () => { // Event saat Wavesurfer siap
                console.log('DEBUG: Wavesurfer ready.');
            });


            // HTML Audio actions -> Wavesurfer
            audioPlayer.addEventListener('play', () => { 
                if (wavesurferInstance && !wavesurferInstance.isPlaying()) {
                    wavesurferInstance.play(); 
                    console.log('DEBUG: audioPlayer play event, memicu wavesurfer.play()');
                }
            });
            audioPlayer.addEventListener('pause', () => { 
                if (wavesurferInstance && wavesurferInstance.isPlaying()) {
                    wavesurferInstance.pause(); 
                    console.log('DEBUG: audioPlayer pause event, memicu wavesurfer.pause()');
                }
            });
            audioPlayer.addEventListener('seeked', () => {
                if (audioPlayer.duration && wavesurferInstance) {
                    wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
                    console.log('DEBUG: audioPlayer seeked event, memicu wavesurfer.seekTo()');
                }
            });
            audioPlayer.addEventListener('timeupdate', () => {
                if (wavesurferInstance && audioPlayer.duration) {
                    // Wavesurfer akan otomatis mengupdate kursornya jika media diset via 'media' option
                }
            });

            // Error handling untuk audio HTML
            audioPlayer.addEventListener('error', (e) => {
                console.error('ERROR: Audio load error (from HTML Audio element):', e);
                errorMessageSpan.textContent = 'Gagal memuat file audio. Periksa URL atau format file.';
                errorDiv.classList.remove('hidden');
            });

            console.log('DEBUG: ✅ Wavesurfer core initialized successfully');
        } catch (error) {
            console.error('ERROR: ❌ Wavesurfer init failed:', error);
            // Fallback UI
            waveformContainer.innerHTML = `
                <div class="p-4 text-center text-red-500 bg-red-50 rounded">
                    <p>Waveform gagal dimuat 😞</p>
                    <p class="text-sm mt-1">Error: ${error.message}. Mungkin masalah CDN atau versi plugin.</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Refresh Halaman</button>
                </div>
            `;
        }
    };

    // Safe Reset Function
    const hideAllOutput = () => {
        console.log('DEBUG: 🔄 Resetting all outputs...');
        
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
            console.log('DEBUG: audioPlayer direset.');
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
            console.log('DEBUG: Wavesurfer instance dihancurkan saat reset.');
        }

        console.log('DEBUG: ✅ All outputs reset');
    };

    // Validate DOM
    const validateDOM = () => {
        const required = {
            lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn,
            loadingDiv, resultDiv, errorDiv, errorMessageSpan, musicOutputDiv,
            audioPlayer, downloadLink, waveformContainer, midiPlayer, midiVisualizer, downloadMidiLink
        };
        
        const missing = Object.entries(required).filter(([key, el]) => !el);
        if (missing.length > 0) {
            console.error('ERROR: ❌ Elemen DOM hilang:', missing.map(([k]) => k));
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Error: Halaman tidak lengkap';
                generateBtn.classList.add('bg-red-500', 'cursor-not-allowed');
            }
            return false;
        }
        console.log('DEBUG: ✅ Semua elemen DOM ditemukan');
        return true;
    };

    // === 3. EVENT LISTENERS ===

    // Tempo slider
    if (tempoSlider) {
        tempoSlider.addEventListener('input', () => {
            tempoValueSpan.textContent = tempoSlider.value === "0" ? "Auto" : tempoSlider.value;
        });
    }

    // Audio start button for mobile
    if (audioStartBtn) {
        audioStartBtn.addEventListener('click', async () => {
            console.log('DEBUG: Tombol Mulai Audio diklik.');
            const success = await initializeAudioContext();
            if (success) {
                audioStartBtn.classList.add('hidden');
                // Wavesurfer akan diinisialisasi setelah generate, bukan di sini
                console.log('DEBUG: AudioContext berhasil diinisialisasi melalui klik tombol.');
            } else {
                errorMessageSpan.textContent = 'Gagal memulai audio. Coba lagi.';
                errorDiv.classList.remove('hidden');
                console.error('ERROR: Gagal memulai AudioContext setelah klik tombol.');
            }
        });
    }

    // MIDI Player Event Listeners (for visual only)
    if (midiPlayer) {
        midiPlayer.addEventListener('load', () => { // Gunakan 'load' untuk html-midi-player
            isMidiLoaded = true;
            midiPlayer.style.opacity = '1';
            console.log('DEBUG: ✅ MIDI loaded and ready to play (visual).');
            // Pastikan MIDI player juga diatur ke paused jika audioPlayer sedang dijeda
            if (audioPlayer.paused) {
                safeMidiControl('pause');
            } else {
                safeMidiControl('play');
            }
            if (midiPlayer.currentTime) midiPlayer.currentTime = audioPlayer.currentTime; // Sinkronkan posisi awal
        });

        midiPlayer.addEventListener('error', (e) => {
            console.error('ERROR: ❌ MIDI load error (from html-midi-player):', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau SoundFont.';
            errorDiv.classList.remove('hidden');
        });
        
        // --- SINKRONISASI BARU UNTUK MIDI PLAYER ---
        audioPlayer.addEventListener('play', () => {
            if (isMidiLoaded) {
                safeMidiControl('play');
                console.log('DEBUG: 🎵 Audio play event: MIDI visual starting.');
            }
        });
        audioPlayer.addEventListener('pause', () => {
            if (isMidiLoaded) {
                safeMidiControl('pause');
                console.log('DEBUG: ⏸️ Audio pause event: MIDI visual paused.');
            }
        });
        audioPlayer.addEventListener('seeking', () => {
            if (isMidiLoaded) {
                if (midiPlayer.currentTime) midiPlayer.currentTime = audioPlayer.currentTime; // Set currentTime saat seeking
                safeMidiControl('pause'); // Jeda MIDI visual saat seeking
                console.log('DEBUG: 🔄 Audio seeking event: MIDI visual seeking & paused.');
            }
        });
        audioPlayer.addEventListener('seeked', () => {
            if (isMidiLoaded) {
                if (midiPlayer.currentTime) midiPlayer.currentTime = audioPlayer.currentTime; // Set currentTime setelah seeked
                if (!audioPlayer.paused) {
                    safeMidiControl('play'); // Lanjutkan jika audioPlayer tidak dijeda
                }
                console.log('DEBUG: ✅ Audio seeked event: MIDI visual resumed.');
            }
        });
    }

    // Main Generate Button
    if (generateBtn && validateDOM()) {
        generateBtn.addEventListener('click', async () => {
            if (!audioContextReady) {
                console.warn('WARN: AudioContext belum siap. Meminta inisialisasi.');
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
                console.warn('WARN: Lirik kosong, menampilkan error.');
                return;
            }

            hideAllOutput();
            loadingDiv.classList.remove('hidden');
            generateBtn.disabled = true;
            generateBtn.textContent = 'Membuat...';
            generateBtn.classList.add('opacity-50');
            console.log('DEBUG: Tombol generate diklik. Memulai proses.');

            try {
                console.log('DEBUG: 🚀 Starting generation... Payload:', { text: lyrics, genre: selectedGenre, tempo: selectedTempo });

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
                console.log('DEBUG: ✅ Response received:', data);

                const audioUrl = data.wav_url || data.mp3_url;
                const midiUrl = data.midi_url;

                if (!audioUrl || !midiUrl) {
                    throw new Error('File audio/MIDI tidak lengkap dari server.');
                }

                // Build full URLs (unchanged)
                const getFullUrl = (url) => {
                    if (url.startsWith('http')) return url;
                    const base = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                    // Pastikan path tidak double slash jika url sudah diawali slash
                    return `${base}${url.startsWith('/') ? url : '/' + url}`;
                };

                const fullAudioUrl = getFullUrl(audioUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('DEBUG: 🔗 Full URLs - Audio:', fullAudioUrl, 'MIDI:', fullMidiUrl);

                // Load Audio ke HTML <audio> element
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load();
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'generated_instrumental.mp3' : 'generated_instrumental.wav';
                console.log('DEBUG: audioPlayer.src diatur ke:', fullAudioUrl);
                
                // Load MIDI (hanya visual, tanpa suara)
                if (midiPlayer) {
                    midiPlayer.src = fullMidiUrl;
                    midiPlayer.style.opacity = '1'; // Pastikan terlihat
                    safeMidiControl('pause'); // Awalnya dijeda, akan di-start saat audioPlayer play
                    if (midiPlayer.currentTime) midiPlayer.currentTime = 0; // Reset waktu
                    console.log('DEBUG: midiPlayer.src diatur ke:', fullMidiUrl);
                }
                if (midiVisualizer) {
                    midiVisualizer.src = fullMidiUrl;
                    console.log('DEBUG: midiVisualizer.src diatur ke:', fullMidiUrl);
                }
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'generated_instrumental.mid';

                // Load Wavesurfer (dengan slight delay untuk stabilitas)
                setTimeout(() => {
                    initOrUpdateWavesurfer(); // Inisialisasi/Update Wavesurfer
                    if (wavesurferInstance) {
                        wavesurferInstance.load(fullAudioUrl); // PENTING: Muat dari URL
                        console.log('DEBUG: Wavesurfer instance memuat:', fullAudioUrl);
                    } else {
                        console.warn('WARN: Wavesurfer instance tidak dibuat, tidak bisa memuat audio.');
                    }
                }, 200);

                // Show results
                musicOutputDiv.classList.remove('hidden');
                resultDiv.classList.remove('hidden');
                console.log('DEBUG: 🎉 Generation complete! Menampilkan hasil.');

            } catch (error) {
                console.error('ERROR: ❌ Generation failed:', error);
                
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
                generateBtn.textContent = 'Buat Instrumental';
                generateBtn.classList.remove('opacity-50');
            }
        });
    }

    // Initial setup
    // Jangan auto-init Wavesurfer di sini; lakukan setelah generate atau user gesture jika diperlukan
    safeMidiControl('reset');
    console.log('DEBUG: 🎵 App ready! (AudioContext akan init on gesture)');

    // Page visibility handler (pause on tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            if (isMidiLoaded) {
                safeMidiControl('pause');
            }
            wavesurferInstance?.pause();
            console.log('DEBUG: Halaman tidak aktif, audio/MIDI dijeda.');
        }
    });

    // Global error handler
    window.addEventListener('error', (e) => {
        console.error('ERROR: 🌐 Global error caught:', e.error?.message || e.message);
        // Only show global error if no specific error is already displayed
        if (errorDiv && errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent = `Global Error: ${e.error?.message || e.message}`;
            errorDiv.classList.remove('hidden');
        }
    });
});
