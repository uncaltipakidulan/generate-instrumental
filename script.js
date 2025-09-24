// script.js

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Mendapatkan referensi ke elemen-elemen DOM ===
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect'); 
    const generateBtn = document.getElementById('generateBtn');
    
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');

    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    const audioPlayerContainer = document.getElementById('audioPlayerContainer');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const waveformContainer = document.getElementById('waveform');
    
    const midiPlayerContainer = document.getElementById('midiPlayerContainer');
    const midiPlayer = document.getElementById('midiPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const downloadMidiLink = document.getElementById('downloadMidiLink');

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
            backend: 'MediaElement', // Use MediaElement for better sync with HTML audio
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
        musicOutputDiv.classList.add('hidden'); // Sembunyikan seluruh output musik
        
        errorMessageSpan.textContent = ''; // Clear error message

        // Reset audio player
        audioPlayer.src = '';
        audioPlayer.load();
        downloadLink.removeAttribute('href');
        downloadLink.removeAttribute('download');

        // Reset MIDI player/visualizer
        if (midiPlayer) {
            midiPlayer.src = '';
        }
        if (midiVisualizer) {
            midiVisualizer.src = '';
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
        lyricsInput, genreSelect, generateBtn, loadingDiv, resultDiv, errorDiv, errorMessageSpan,
        musicOutputDiv, audioPlayerContainer, audioPlayer, downloadLink, waveformContainer,
        midiPlayerContainer, midiPlayer, midiVisualizer, downloadMidiLink
    ];
    
    // Collect names of missing elements for better debugging
    const missingElements = requiredElements.filter(el => el === null).map(el => el ? el.id : 'N/A'); // Lebih baik untuk logging

    if (missingElements.length > 0) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar. Missing:', missingElements.join(', '));
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Error: Elemen tidak lengkap';
        }
        return; // Hentikan eksekusi jika elemen penting tidak ada
    }

    // === 4. Event Listener untuk Tombol Generate ===
    generateBtn.addEventListener('click', async () => {
        // --- PENTING: MEMULAI AUDIO CONTEXT SEGERA SETELAH USER GESTURE ---
        // Panggil Tone.start() di sini, di awal event listener
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            try {
                await Tone.start();
                console.log('AudioContext started by Tone.js on user gesture.');
            } catch (e) {
                console.error("Failed to start Tone.js AudioContext on user gesture:", e);
                // Jika gagal, mungkin tidak ada audio yang akan diputar
                errorMessageSpan.textContent = `Gagal memulai audio: ${e.message}. Coba lagi.`;
                errorDiv.classList.remove('hidden');
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
                generateBtn.textContent = 'Buat Instrumental';
                return; // Hentikan eksekusi jika AudioContext tidak dapat dimulai
            }
        }
        // Pastikan AudioContext untuk HTML audio element juga resume
        // Perlu mendapatkan context dari elemen audio jika ada
        if (audioPlayer.audioContext && audioPlayer.audioContext.state === 'suspended') { // Menggunakan properti audioContext jika ada
            audioPlayer.audioContext.resume().catch(e => console.warn("Failed to resume HTML audio context:", e));
        } else if (audioPlayer.mozAudioChannel && audioPlayer.mozAudioChannel.context && audioPlayer.mozAudioChannel.context.state === 'suspended') { // Firefox specific
             audioPlayer.mozAudioChannel.context.resume().catch(e => console.warn("Failed to resume HTML audio context (Firefox):", e));
        }


        const lyrics = lyricsInput.value.trim();
        const selectedGenre = genreSelect.value;

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
            const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: lyrics, genre: selectedGenre }),
            });

            if (!response.ok) {
                let errorDetails = 'Terjadi kesalahan yang tidak diketahui.';
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.error || `HTTP error! status: ${response.status}`;
                } catch (jsonError) {
                    errorDetails = `Error ${response.status}: ${response.statusText || 'Gagal memparsing respons error.'}`;
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();
            const base64Wav = data.base64_wav;
            const base64Midi = data.base64_midi;

            if (!base64Wav || !base64Midi) {
                throw new Error("Respons backend tidak lengkap (missing WAV or MIDI data).");
            }

            // ===========================================
            // TANGANI WAV UNTUK DOWNLOAD DAN WAVESURFER
            // ===========================================
            const audioDataURL = `data:audio/wav;base64,${base64Wav}`;
            audioPlayer.src = audioDataURL;
            audioPlayer.load();

            downloadLink.href = audioDataURL;
            downloadLink.download = 'generated_instrumental.wav';

            // ===========================================
            // TANGANI MIDI UNTUK MIDI-PLAYER DAN VISUALIZER
            // ===========================================
            const midiDataURL = `data:audio/midi;base64,${base64Midi}`;
            if (midiPlayer) {
                midiPlayer.src = midiDataURL;
            }
            if (midiVisualizer) {
                midiVisualizer.src = midiDataURL; // Juga set src di visualizer untuk redundansi
            }
            downloadMidiLink.href = midiDataURL;
            downloadMidiLink.download = 'generated_instrumental.mid';

            // ===========================================
            // TANGANI WAVESURFER
            // ===========================================
            initOrUpdateWavesurfer();
            wavesurferInstance.load(audioDataURL);


            // Tampilkan seluruh area output musik
            musicOutputDiv.classList.remove('hidden');
            resultDiv.classList.remove('hidden');

            // Opsional: Mulai pemutar MIDI secara otomatis setelah semua dimuat
            if (midiPlayer && midiPlayer.start) {
                midiPlayer.start();
            }
            // Opsional: Mulai pemutar WAV secara otomatis
            if (audioPlayer.paused) {
                audioPlayer.play().catch(e => console.warn("Autoplay of HTML audioPlayer blocked:", e));
            }


        } catch (error) {
            console.error('Error generating music:', error);
            errorMessageSpan.textContent = `Terjadi kesalahan: ${error.message || 'Server tidak merespons.'}`;
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Instrumental';
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    // (Akan direfresh setiap kali ada generate baru)
    initOrUpdateWavesurfer();
});
