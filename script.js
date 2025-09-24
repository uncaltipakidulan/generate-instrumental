// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoSlider = document.getElementById('tempoSlider');     // BARU: Slider Tempo
    const tempoValueSpan = document.getElementById('tempoValue');   // BARU: Span untuk menampilkan nilai tempo
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
    const downloadLink = document.getElementById('downloadLink'); // Download MP3/WAV
    const waveformContainer = document.getElementById('waveform'); // Container for Wavesurfer
    
    // MIDI related elements
    const midiPlayerContainer = document.getElementById('midiPlayerContainer');
    const midiPlayer = document.getElementById('midiPlayer'); // The <midi-player> element
    const midiVisualizer = document.getElementById('midiVisualizer'); // The <midi-visualizer> element
    const downloadMidiLink = document.getElementById('downloadMidiLink'); // Download MIDI

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link'; // Pastikan ini HTTPS!

    let wavesurferInstance = null; // Instans Wavesurfer

    // Fungsi untuk menginisialisasi atau memperbarui Wavesurfer
    const initOrUpdateWavesurfer = () => {
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        
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
            media: audioPlayer
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
    function hideAllOutput() {
        loadingDiv.classList.add('hidden');
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        musicOutputDiv.classList.add('hidden');
        
        errorMessageSpan.textContent = '';

        audioPlayer.src = '';
        audioPlayer.load();
        downloadLink.removeAttribute('href');
        downloadLink.removeAttribute('download');

        if (midiPlayer) {
            midiPlayer.src = '';
        }
        if (midiVisualizer) {
            midiVisualizer.src = '';
        }
        downloadMidiLink.removeAttribute('href');
        downloadMidiLink.removeAttribute('download');

        if (wavesurferInstance) {
            wavesurferInstance.empty();
        }
    }

    // === Validasi Elemen DOM ===
    const requiredElements = [
        lyricsInput, genreSelect, tempoSlider, tempoValueSpan, generateBtn, loadingDiv, resultDiv, errorDiv, errorMessageSpan,
        musicOutputDiv, audioPlayerContainer, audioPlayer, downloadLink, waveformContainer,
        midiPlayerContainer, midiPlayer, midiVisualizer, downloadMidiLink
    ];
    
    const missingElements = requiredElements.filter(el => el === null).map(el => el ? el.id : 'N/A');

    if (missingElements.length > 0) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar. Missing:', missingElements.join(', '));
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Error: Elemen tidak lengkap';
        }
        return;
    }

    // BARU: Event listener untuk slider tempo
    tempoSlider.addEventListener('input', () => {
        if (tempoSlider.value === "0") {
            tempoValueSpan.textContent = "Auto";
        } else {
            tempoValueSpan.textContent = tempoSlider.value;
        }
    });


    // === Event Listener untuk Tombol Generate ===
    generateBtn.addEventListener('click', async () => {
        const lyrics = lyricsInput.value.trim();
        const selectedGenre = genreSelect.value;
        const selectedTempo = tempoSlider.value === "0" ? "auto" : tempoSlider.value; // BARU: Ambil nilai tempo

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
            // Memulai AudioContext Tone.js sesegera mungkin pada user gesture
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
                    return;
                }
            }
            // Pastikan AudioContext untuk HTML audio element juga resume
            // Ini diperlukan karena Tone.start() mungkin tidak mempengaruhi semua AudioContext
            if (audioPlayer.getContext && audioPlayer.getContext().state === 'suspended') {
                 audioPlayer.getContext().resume().catch(e => console.warn("Failed to resume HTML audio context:", e));
            } else if (audioPlayer.mozAudioChannel && audioPlayer.mozAudioChannel.context && audioPlayer.mozAudioChannel.context.state === 'suspended') {
                 audioPlayer.mozAudioChannel.context.resume().catch(e => console.warn("Failed to resume HTML audio context (Firefox):", e));
            }


            const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: lyrics, genre: selectedGenre, tempo: selectedTempo }), // BARU: Kirim tempo
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
            const wavUrl = data.wav_url; // BARU: Backend mengembalikan URL, bukan base64
            const midiUrl = data.midi_url; // BARU: Backend mengembalikan URL, bukan base64

            if (!wavUrl || !midiUrl) {
                throw new Error("Respons backend tidak lengkap (missing WAV/MP3 or MIDI URL).");
            }

            // ===========================================
            // TANGANI AUDIO (MP3/WAV) UNTUK PLAYBACK DAN DOWNLOAD
            // ===========================================
            // URL audio sekarang adalah URL langsung dari server Flask
            audioPlayer.src = `${BACKEND_API_URL}${wavUrl}`;
            audioPlayer.load();

            downloadLink.href = `${BACKEND_API_URL}${wavUrl}`;
            downloadLink.download = wavUrl.endsWith('.mp3') ? 'generated_instrumental.mp3' : 'generated_instrumental.wav';


            // ===========================================
            // TANGANI MIDI UNTUK PLAYER DAN VISUALIZER
            // ===========================================
            // URL MIDI sekarang adalah URL langsung dari server Flask
            if (midiPlayer) {
                midiPlayer.src = `${BACKEND_API_URL}${midiUrl}`;
            }
            if (midiVisualizer) {
                midiVisualizer.src = `${BACKEND_API_URL}${midiUrl}`;
            }
            downloadMidiLink.href = `${BACKEND_API_URL}${midiUrl}`;
            downloadMidiLink.download = 'generated_instrumental.mid';

            // ===========================================
            // TANGANI WAVESURFER
            // ===========================================
            initOrUpdateWavesurfer();
            // Wavesurfer akan memuat dari URL file MP3/WAV
            wavesurferInstance.load(`${BACKEND_API_URL}${wavUrl}`);

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
            generateBtn.textContent = 'Buat Instrumental';
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    initOrUpdateWavesurfer();
});
