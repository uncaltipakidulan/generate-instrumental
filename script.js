// script.js

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Mendapatkan referensi ke elemen-elemen DOM ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValueSpan = document.getElementById('tempoValue');
    const generateBtn = document.getElementById('generateBtn');
    
    // Status / Message elements
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');

    // Main output container
    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    // WAV/MP3 related elements
    const audioPlayerContainer = document.getElementById('audioPlayerContainer');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const waveformContainer = document.getElementById('waveform');
    
    // MIDI related elements
    const midiPlayerContainer = document.getElementById('midiPlayerContainer');
    const midiPlayer = document.getElementById('midiPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const downloadMidiLink = document.getElementById('downloadMidiLink');

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link'; // Pastikan ini HTTPS!

    let wavesurferInstance = null; // Instans Wavesurfer


    // === 2. DEFINISI FUNGSI-FUNGSI PEMBANTU ===
    // Pastikan fungsi-fungsi ini didefinisikan SEBELUM DIPANGGIL

    // Fungsi untuk menginisialisasi atau memperbarui Wavesurfer
    const initOrUpdateWavesurfer = () => {
        // Destroy existing instance if any
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null; // Clear reference
        }
        
        // Ensure container is not null before creating Wavesurfer
        if (!waveformContainer) {
            console.error("Wavesurfer container #waveform not found!");
            return;
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
            backend: 'MediaElement',
            media: audioPlayer // Connect directly to the standard HTML audio element
        });

        // Event listeners for playback synchronization
        wavesurferInstance.on('interaction', () => {
            if (wavesurferInstance.isPlaying()) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
        });
        audioPlayer.addEventListener('play', () => wavesurferInstance.play());
        audioPlayer.addEventListener('pause', () => wavesurferInstance.pause());
        audioPlayer.addEventListener('seeked', () => {
            if (audioPlayer.duration) {
                wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
            }
        });
        audioPlayer.addEventListener('timeupdate', () => {
            if (wavesurferInstance.isPlaying() && audioPlayer.duration) {
                wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
            }
        });
    };

    // Fungsi untuk menyembunyikan semua pesan status dan output
    const hideAllOutput = () => { // Menggunakan const untuk konsistensi
        loadingDiv.classList.add('hidden');
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        musicOutputDiv.classList.add('hidden');
        
        errorMessageSpan.textContent = ''; // Clear error message

        // Reset audio player
        audioPlayer.src = '';
        audioPlayer.load();
        downloadLink.removeAttribute('href');
        downloadLink.removeAttribute('download');

        // Reset MIDI player/visualizer
        if (midiPlayer) {
            midiPlayer.src = '';
            midiPlayer.currentTime = 0; // Reset waktu
            // midiPlayer.stop(); // Hapus ini, karena midiPlayer tidak punya metode stop()
        }
        if (midiVisualizer) {
            midiVisualizer.src = '';
            midiVisualizer.currentTime = 0; // Reset waktu
        }
        downloadMidiLink.removeAttribute('href');
        downloadMidiLink.removeAttribute('download');

        // Reset Wavesurfer
        if (wavesurferInstance) {
            wavesurferInstance.empty();
        }
    };


    // === 3. Validasi Elemen DOM ===
    // Pastikan semua elemen yang dibutuhkan ada saat DOMContentLoaded
    const requiredElements = [
        lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn, loadingDiv, resultDiv, errorDiv, errorMessageSpan,
        musicOutputDiv, audioPlayerContainer, audioPlayer, downloadLink, waveformContainer,
        midiPlayerContainer, midiPlayer, midiVisualizer, downloadMidiLink
    ];
    
    // Collect names of missing elements for better debugging
    // Menggunakan ID elemen untuk identifikasi yang lebih baik
    const missingElements = requiredElements.filter(el => el === null).map(el => el ? el.id : 'N/A');

    if (missingElements.length > 0) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar. Missing:', missingElements.join(', '));
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Error: Elemen tidak lengkap';
        }
        return; // Hentikan eksekusi jika elemen penting tidak ada
    }

    // === 4. Event Listener untuk Slider Tempo ===
    tempoSlider.addEventListener('input', () => {
        if (tempoSlider.value === "0") {
            tempoValueSpan.textContent = "Auto";
        } else {
            tempoValueSpan.textContent = tempoSlider.value;
        }
    });

    // === 5. Event Listener untuk Tombol Generate ===
    generateBtn.addEventListener('click', async () => {
        // --- PENTING: MEMULAI AUDIO CONTEXT SEGERA SETELAH USER GESTURE ---
        // Panggil Tone.start() di sini, di awal event listener
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            try {
                await Tone.start();
                console.log('AudioContext started by Tone.js on user gesture.');
            } catch (e) {
                console.error("Failed to start Tone.js AudioContext on user gesture:", e);
                errorMessageSpan.textContent = `Gagal memulai audio: ${e.message}. Coba lagi.`;
                errorDiv.classList.remove('hidden');
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
                generateBtn.textContent = 'Buat Instrumental';
                return; // Hentikan eksekusi jika AudioContext tidak dapat dimulai
            }
        }
        // Pastikan AudioContext untuk HTML audio element juga resume
        // Ini diperlukan karena Tone.start() mungkin tidak mempengaruhi semua AudioContext
        // Menggunakan AudioContext dari elemen audio jika ada
        if (audioPlayer.getContext && audioPlayer.getContext().state === 'suspended') {
             audioPlayer.getContext().resume().catch(e => console.warn("Failed to resume HTML audio context:", e));
        } else if (audioPlayer.mozAudioChannel && audioPlayer.mozAudioChannel.context && 
                   audioPlayer.mozAudioChannel.context.state === 'suspended') {
             audioPlayer.mozAudioChannel.context.resume().catch(e => console.warn("Failed to resume HTML audio context (Firefox):", e));
        }


        const lyrics = lyricsInput.value.trim();
        const selectedGenre = genreSelect.value;
        const selectedTempo = tempoSlider.value === "0" ? "auto" : tempoSlider.value;

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

        try {
            // DEBUG: Log request details
            console.log('=== GENERATE MUSIC REQUEST ===');
            console.log('Backend URL:', BACKEND_API_URL);
            console.log('Request payload:', { text: lyrics, genre: selectedGenre, tempo: selectedTempo });

            const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: lyrics, 
                    genre: selectedGenre, 
                    tempo: selectedTempo 
                })
            });

            // DEBUG: Log response details
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            console.log('Response headers:', [...response.headers.entries()]);

            if (!response.ok) {
                let errorDetails = 'Terjadi kesalahan yang tidak diketahui.';
                try {
                    const errorData = await response.json();
                    console.error('Error response data:', errorData);
                    errorDetails = errorData.error || `HTTP error! status: ${response.status}`;
                } catch (jsonError) {
                    console.error('Failed to parse error response as JSON:', jsonError);
                    errorDetails = `Error ${response.status}: ${response.statusText || 'Gagal memparsing respons error.'}`;
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();
            console.log('=== SUCCESSFUL RESPONSE ===');
            console.log('Response data:', data);
            console.log('wav_url:', data.wav_url);
            console.log('midi_url:', data.midi_url);

            const wavUrl = data.wav_url;
            const midiUrl = data.midi_url;

            if (!wavUrl || !midiUrl) {
                throw new Error("Respons backend tidak lengkap (missing WAV/MP3 or MIDI URL).");
            }

            // ===========================================
            // Menggabungkan BACKEND_API_URL jika URL relatif
            // ===========================================
            // Backend sekarang mengembalikan URL RELATIF. Kita perlu menggabungkannya dengan BACKEND_API_URL.
            const getFullUrl = (relativePath) => {
                // Pastikan relativePath tidak dimulai dengan '/' ganda jika BACKEND_API_URL sudah punya '/'
                const backendBase = BACKEND_API_URL.endsWith('/') ? BACKEND_API_URL.slice(0, -1) : BACKEND_API_URL;
                const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
                return `${backendBase}${path}`;
            };

            const fullWavUrl = getFullUrl(wavUrl);
            const fullMidiUrl = getFullUrl(midiUrl);
            
            console.log('Full WAV URL:', fullWavUrl);
            console.log('Full MIDI URL:', fullMidiUrl);

            // ===========================================
            // TANGANI AUDIO (MP3/WAV) UNTUK PLAYBACK DAN DOWNLOAD
            // ===========================================
            audioPlayer.src = fullWavUrl;
            audioPlayer.load();
            console.log('Audio player src set to:', fullWavUrl);

            downloadLink.href = fullWavUrl;
            downloadLink.download = fullWavUrl.endsWith('.mp3') ? 'generated_instrumental.mp3' : 'generated_instrumental.wav';
            console.log('Download link href set to:', fullWavUrl);

            // ===========================================
            // TANGANI MIDI UNTUK PLAYER DAN VISUALIZER
            // ===========================================
            if (midiPlayer) {
                midiPlayer.src = fullMidiUrl;
                console.log('MIDI player src set to:', fullMidiUrl);
            }
            if (midiVisualizer) {
                midiVisualizer.src = fullMidiUrl; // Juga set src di visualizer untuk redundansi
                console.log('MIDI visualizer src set to:', fullMidiUrl);
            }
            downloadMidiLink.href = fullMidiUrl;
            downloadMidiLink.download = 'generated_instrumental.mid';
            console.log('MIDI download link href set to:', fullMidiUrl);

            // ===========================================
            // TANGANI WAVESURFER
            // ===========================================
            initOrUpdateWavesurfer();
            if (wavesurferInstance) {
                wavesurferInstance.load(fullWavUrl);
                console.log('Wavesurfer loading:', fullWavUrl);
            }

            // Tampilkan seluruh area output musik
            musicOutputDiv.classList.remove('hidden');
            resultDiv.classList.remove('hidden');

            // Opsional: Mulai pemutar WAV secara otomatis (dengan user gesture check)
            if (audioPlayer.paused && !audioPlayer.ended) {
                try {
                    await audioPlayer.play();
                    console.log('Audio player autoplay started');
                } catch (e) {
                    console.warn("Autoplay of HTML audioPlayer blocked:", e);
                    // Fallback: Tunggu user interaction
                    audioPlayer.addEventListener('click', () => {
                        audioPlayer.play().catch(e => console.warn('Play after click failed:', e));
                    }, { once: true });
                }
            }

            console.log('=== MUSIC GENERATION COMPLETE ===');

        } catch (error) {
            console.error('=== ERROR GENERATING MUSIC ===');
            console.error('Error details:', error);
            console.error('Error stack:', error.stack);
            
            errorMessageSpan.textContent = `Terjadi kesalahan: ${error.message || 'Server tidak merespons.'}`;
            errorDiv.classList.remove('hidden');
            
            if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
                console.error('NetworkError detected - possible causes:');
                console.error('- Backend server not running');
                console.error('- Pinggy tunnel down');
                console.error('- CORS issues');
                console.error('- CSP blocking connect-src');
                console.error('- Firewall/network blocking');
                console.error('URL being fetched:', `${BACKEND_API_URL}/generate-instrumental`);
            }
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Instrumental';
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    // (Akan direfresh setiap kali ada generate baru)
    initOrUpdateWavesurfer();
});
