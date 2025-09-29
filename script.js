// script.js - VERSI DIPERBAIKI: Sinkronisasi MIDI lebih baik, loading plugin, dan penanganan error

document.addEventListener('DOMContentLoaded', () => {
    // === 1. ELEMEN DOM ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    const audioStartBtn = document.getElementById('audioStartBtn');
    
    // Elemen status
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');
    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    // Elemen audio
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const waveformContainer = document.getElementById('waveform');
    
    // Elemen MIDI
    const midiPlayer = document.getElementById('midiPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // URL Backend - Deteksi otomatis lokal vs produksi (Pinggy)
    const BACKEND_API_URL = window.location.hostname.includes('github.io') 
        ? 'https://dindwwctyp.a.pinggy.link' // Ganti jika URL Pinggy berubah
        : 'http://localhost:5000';

    let wavesurferInstance = null;
    let audioContextReady = false;
    let isMidiLoaded = false; // Lacak status load MIDI

    console.log('Aplikasi dimulai... URL Backend:', BACKEND_API_URL);

    // === 2. FUNGSI PEMBANTU ===
    // Inisialisasi AudioContext (perbaiki masalah mobile/load pertama)
   const initializeAudioContext = async () => {
    if (audioContextReady) {
        console.log('DEBUG: AudioContext sudah siap.');
        return true;
    }

    try {
        if (typeof Tone !== 'undefined' && Tone.context?.state !== 'running') {
            console.log('DEBUG: Mencoba memulai Tone.js AudioContext...');
            await Tone.start();
            console.log('DEBUG: ✅ Tone.js AudioContext dimulai');
        }
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            console.log('DEBUG: ⏳ AudioContext HTML5 ditangguhkan. Mencoba resume...');
            await audioCtx.resume(); // Coba resume secara eksplisit
            console.log('DEBUG: ✅ AudioContext HTML5 diresume.');
        } else {
            console.log('DEBUG: ✅ AudioContext HTML5 sudah berjalan.');
        }
        
        if (midiPlayer && midiPlayer.getContext && midiPlayer.getContext()?.state === 'suspended') {
            console.log('DEBUG: ⏳ AudioContext MIDI Player ditangguhkan. Mencoba resume...');
            await midiPlayer.getContext().resume();
            console.log('DEBUG: ✅ AudioContext MIDI Player diresume.');
        } else {
            console.log('DEBUG: ✅ AudioContext MIDI Player sudah berjalan.');
        }
        
        audioContextReady = true;
        if (audioStartBtn) audioStartBtn.classList.add('hidden');
        console.log('DEBUG: initializeAudioContext berhasil. audioContextReady = true.');
        return true;
    } catch (error) {
        console.error('DEBUG: ❌ initializeAudioContext gagal:', error);
        if (audioStartBtn) {
            audioStartBtn.textContent = 'Audio Error - Coba Lagi';
            audioStartBtn.classList.remove('hidden');
        }
        return false;
    }
};
    // Kontrol MIDI Aman (hindari panggilan method langsung)
    const safeMidiControl = (action) => {
        if (!midiPlayer || !isMidiLoaded) {
            console.warn('Pemutar MIDI belum siap untuk aksi:', action);
            return;
        }

        try {
            switch (action) {
                case 'reset':
                    midiPlayer.src = ''; // Kosongkan src
                    midiVisualizer.src = ''; // Kosongkan visualizer
                    midiPlayer.removeAttribute('src');
                    midiVisualizer.removeAttribute('src');
                    midiPlayer.style.opacity = '0.5'; // Status visual dinonaktifkan
                    if (midiPlayer.currentTime) midiPlayer.currentTime = 0;
                    console.log('🔄 Pemutar MIDI direset');
                    break;
                case 'load':
                    // Picu event load secara manual jika diperlukan
                    midiPlayer.dispatchEvent(new Event('load'));
                    break;
                default:
                    console.warn(`Aksi MIDI tidak dikenal: ${action}`);
            }
        } catch (error) {
            console.error(`❌ Kesalahan Kontrol MIDI (${action}):`, error);
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
            console.warn('DEBUG: Wavesurfer dilewati - container/audio belum siap atau audioPlayer tidak ditemukan.');
            return;
        }

        try {
            // Perbaikan ini: Inisialisasi plugin secara langsung, lalu masukkan ke array
            // Wavesurfer v7 API kadang lebih stabil dengan cara ini atau dengan meregistrasi dulu
            const pluginsToLoad = [];

            // Memastikan plugin dimuat sebelum digunakan
            if (typeof WaveSurfer.Minimap !== 'undefined') { // Perhatikan huruf besar 'M'
                pluginsToLoad.push(
                    WaveSurfer.Minimap.create({
                        container: '#waveform-minimap',
                        overviewColor: '#ccc', // Ganti sesuai selera
                        progressColor: '#999',
                        height: 30,
                    })
                );
                console.log('DEBUG: ✅ Wavesurfer Minimap plugin siap.');
            } else {
                console.warn('DEBUG: ⚠️ Wavesurfer Minimap plugin NOT found (via type check).');
            }

            if (typeof WaveSurfer.Timeline !== 'undefined') { // Perhatikan huruf besar 'T'
                pluginsToLoad.push(
                    WaveSurfer.Timeline.create({
                        container: '#waveform-timeline',
                        timeInterval: 0.5,
                        primaryLabelInterval: 10, // Tampilkan label setiap 10 detik
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
                console.warn('DEBUG: ⚠️ Wavesurfer Timeline plugin NOT found (via type check).');
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
                backend: 'WebAudio', // Ini sudah deprecated di v7, tapi masih bisa jalan.
                media: audioPlayer, // PENTING: Sambungkan langsung ke elemen HTML audio
                plugins: pluginsToLoad // Gunakan array pluginsToLoad
            });

            // Event listeners untuk sync playback
            // Wavesurfer actions -> HTML Audio
            wavesurferInstance.on('play', () => {
                audioPlayer.play().catch(e => console.warn('DEBUG: Audio play failed from Wavesurfer:', e));
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
                    // Wavesurfer akan otomatis mengupdate kursornya jika media terhubung.
                    // Tidak perlu memanggil wavesurferInstance.seekTo() di timeupdate jika `media` sudah diset
                }
            });


            // Error handling untuk audio HTML
            audioPlayer.addEventListener('error', (e) => {
                console.error('DEBUG: Audio load error (from HTML Audio element):', e);
                errorMessageSpan.textContent = 'Gagal memuat file audio. Periksa URL atau format file.';
                errorDiv.classList.remove('hidden');
            });
            
            console.log('DEBUG: ✅ Wavesurfer core initialized successfully');
        } catch (error) {
            console.error('DEBUG: ❌ Wavesurfer init failed:', error);
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
    
    // Fungsi Reset (diperbarui untuk MIDI)
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
            audioPlayer.load();
        }
        if (downloadLink) {
            downloadLink.removeAttribute('href');
            downloadLink.removeAttribute('download');
        }

        // Reset MIDI
        safeMidiControl('reset');
        isMidiLoaded = false;
        if (downloadMidiLink) {
            downloadMidiLink.removeAttribute('href');
            downloadMidiLink.removeAttribute('download');
        }

        // Reset Wavesurfer
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }

        console.log('✅ Semua output direset');
    };

    // Validasi DOM (tidak berubah)
    const validateDOM = () => {
        const required = {
            lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn,
            loadingDiv, resultDiv, errorDiv, errorMessageSpan, musicOutputDiv,
            audioPlayer, downloadLink, waveformContainer, midiPlayer, midiVisualizer, downloadMidiLink
        };
        
        const missing = Object.entries(required).filter(([key, el]) => !el);
        if (missing.length > 0) {
            console.error('❌ Elemen DOM hilang:', missing.map(([k]) => k));
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Kesalahan: Halaman tidak lengkap';
                generateBtn.classList.add('bg-red-500', 'cursor-not-allowed');
            }
            return false;
        }
        console.log('✅ Semua elemen DOM ditemukan');
        return true;
    };

    // === 3. EVENT LISTENER ===

    // Slider tempo (tidak berubah)
    if (tempoSlider) {
        tempoSlider.addEventListener('input', () => {
            tempoValueSpan.textContent = tempoSlider.value === "0" ? "Otomatis" : tempoSlider.value;
        });
    }

    // Tombol mulai audio (diperbarui untuk menangani gesture)
    if (audioStartBtn) {
        audioStartBtn.addEventListener('click', async () => {
            const success = await initializeAudioContext();
            if (success) {
                audioStartBtn.classList.add('hidden');
                // Sekarang inisialisasi Wavesurfer setelah konteks siap
                initOrUpdateWavesurfer();
            }
        });
    }

    // Event MIDI Player (DIPERBAIKI: Gunakan event daripada method langsung)
    if (midiPlayer) {
        midiPlayer.addEventListener('load', () => {
            isMidiLoaded = true;
            midiPlayer.style.opacity = '1';
            console.log('✅ MIDI dimuat - sinkronisasi dengan audio');
            // Sinkronisasi posisi awal
            if (audioPlayer.currentTime) {
                midiPlayer.currentTime = audioPlayer.currentTime; // Jika didukung
            }
        });

        midiPlayer.addEventListener('error', (e) => {
            console.error('❌ Kesalahan load MIDI:', e);
            errorMessageSpan.textContent = 'Gagal memuat file MIDI. Periksa URL atau SoundFont.';
            errorDiv.classList.remove('hidden');
        });

        // Sinkronisasi: Audio play/pause → MIDI (gunakan event MIDI jika tersedia, atau waktu bersama)
        audioPlayer.addEventListener('play', () => {
            if (isMidiLoaded) {
                // Untuk html-midi-player, picu play via event atau transport internal
                if (midiPlayer.play) midiPlayer.play(); else midiPlayer.dispatchEvent(new Event('play'));
                console.log('🎵 Pemutaran audio: MIDI disinkronkan');
            }
        });

        audioPlayer.addEventListener('pause', () => {
            if (isMidiLoaded) {
                // Gunakan stop atau event pause sebagai gantinya
                if (midiPlayer.stop) midiPlayer.stop(); else midiPlayer.dispatchEvent(new Event('pause'));
                console.log('⏸️ Jeda audio: MIDI disinkronkan');
            }
        });

        audioPlayer.addEventListener('timeupdate', () => {
            if (isMidiLoaded && audioPlayer.duration) {
                const progress = audioPlayer.currentTime / audioPlayer.duration;
                // Sinkronisasi posisi MIDI jika didukung (html-midi-player mungkin butuh penanganan khusus)
                if (midiPlayer.setCurrentTime) midiPlayer.setCurrentTime(audioPlayer.currentTime);
                console.log('🔄 Pembaruan waktu audio: Posisi MIDI disinkronkan');
            }
        });

        audioPlayer.addEventListener('seeking', () => {
            if (isMidiLoaded) {
                // Jeda selama seek untuk menghindari gangguan
                if (midiPlayer.stop) midiPlayer.stop(); else midiPlayer.dispatchEvent(new Event('pause'));
                console.log('🔄 Seeking: MIDI dijeda');
            }
        });

        audioPlayer.addEventListener('seeked', () => {
            if (isMidiLoaded) {
                // Lanjutkan jika sedang diputar
                if (!audioPlayer.paused) {
                    if (midiPlayer.play) midiPlayer.play(); else midiPlayer.dispatchEvent(new Event('play'));
                }
                // Sinkronisasi posisi
                if (midiPlayer.setCurrentTime) midiPlayer.setCurrentTime(audioPlayer.currentTime);
                console.log('✅ Seek selesai: MIDI dilanjutkan dan disinkronkan');
            }
        });
    }

    // Tombol Generate Utama (perbaikan minor untuk penanganan error yang lebih baik)
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
                console.log('🚀 Memulai generasi... Payload:', { text: lyrics, genre: selectedGenre, tempo: selectedTempo });

                const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: lyrics, genre: selectedGenre, tempo: selectedTempo })
                });

                if (!response.ok) {
                    let errorMsg = `Kesalahan server: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                    } catch (e) {}
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                console.log('✅ Respons diterima:', data);

                const audioUrl = data.wav_url || data.mp3_url;
                const midiUrl = data.midi_url;

                if (!audioUrl || !midiUrl) {
                    throw new Error('File audio/MIDI tidak lengkap dari server.');
                }

                // Bangun URL lengkap (tidak berubah)
                const getFullUrl = (url) => {
                    if (url.startsWith('http')) return url;
                    const base = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                    return `${base}${url.startsWith('/') ? url : '/' + url}`;
                };

                const fullAudioUrl = getFullUrl(audioUrl);
                const fullMidiUrl = getFullUrl(midiUrl);

                console.log('🔗 URL Lengkap - Audio:', fullAudioUrl, 'MIDI:', fullMidiUrl);

                // Muat Audio
                audioPlayer.src = fullAudioUrl;
                audioPlayer.load();
                downloadLink.href = fullAudioUrl;
                downloadLink.download = fullAudioUrl.includes('.mp3') ? 'instrumental.mp3' : 'instrumental.wav';
                
                // Muat MIDI (visual saja - tanpa suara)
                safeMidiControl('load'); // Picu load
                midiPlayer.src = fullMidiUrl;
                midiPlayer.style.opacity = '1';
                midiVisualizer.src = fullMidiUrl;
                downloadMidiLink.href = fullMidiUrl;
                downloadMidiLink.download = 'instrumental.mid';

                // Muat Wavesurfer (dengan penundaan untuk stabilitas)
                setTimeout(() => {
                    initOrUpdateWavesurfer();
                    if (wavesurferInstance) {
                        wavesurferInstance.load(fullAudioUrl);
                    }
                }, 200);

                // Tampilkan hasil
                musicOutputDiv.classList.remove('hidden');
                resultDiv.classList.remove('hidden');
                console.log('🎉 Generasi selesai!');

            } catch (error) {
                console.error('❌ Generasi gagal:', error);
                
                let userMsg = error.message || 'Kesalahan tidak dikenal.';
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    userMsg = `Tidak bisa terhubung ke ${BACKEND_API_URL}. Periksa: Flask berjalan? Pinggy aktif?`;
                } else if (error.message.includes('NetworkError')) {
                    userMsg = 'Koneksi gagal. Restart tunnel: ssh -R0:localhost:5000 a.pinggy.io';
                } else if (error.message.includes('mp3_file_path')) {
                    userMsg = 'Kesalahan backend: Konversi MP3 gagal. Periksa path FFmpeg dan SoundFont di Windows.';
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

    // Pengaturan awal (tunggu gesture sebelum inisialisasi penuh)
    // Jangan auto-inisialisasi Wavesurfer di sini; lakukan setelah klik pengguna
    safeMidiControl('reset');
    console.log('🎵 Aplikasi siap! (AudioContext akan diinisialisasi pada gesture)');

    // Penanganan visibilitas halaman (jeda saat tab switch - diperbaiki untuk MIDI)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioPlayer?.pause();
            if (isMidiLoaded) {
                if (midiPlayer.stop) midiPlayer.stop(); else midiPlayer.dispatchEvent(new Event('pause'));
            }
            wavesurferInstance?.pause();
        }
    });

    // Penanganan error global (tidak berubah)
    window.addEventListener('error', (e) => {
        console.error('🌐 Kesalahan global tertangkap:', e.error?.message || e.message);
        if (errorDiv && errorDiv.classList.contains('hidden')) {
            errorMessageSpan.textContent = `Kesalahan Global: ${e.error?.message || e.message}`;
            errorDiv.classList.remove('hidden');
        }
    });
});
