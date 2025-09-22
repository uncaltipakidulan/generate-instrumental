document.addEventListener('DOMContentLoaded', () => {
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const musicOutput = document.getElementById('musicOutput');
    const audioPlayer = document.getElementById('audioPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const waveformContainer = document.getElementById('waveform');
    const errorMessage = document.getElementById('errorMessage');

    // GANTI DENGAN URL NGROK ATAU ALAMAT IP BACKEND ANDA
    // Pastikan backend Anda berjalan dan mengarahkan ke port Flask (biasanya 5000)
    const BACKEND_API_URL = 'https://vWQ3MNnuqZj@free.pinggy.io'; // <-- GANTI INI!

    let wavesurferInstance = null; // Instans Wavesurfer

    // Fungsi untuk menginisialisasi atau memperbarui Wavesurfer
    const initOrUpdateWavesurfer = () => {
        if (wavesurferInstance) {
            wavesurferInstance.destroy(); // Hancurkan instans sebelumnya jika ada
        }
        wavesurferInstance = WaveSurfer.create({
            container: waveformContainer,
            waveColor: '#a0f0ff', // Warna gelombang
            progressColor: '#ffd700', // Warna progres
            cursorColor: '#ff00ff', // Warna kursor
            barWidth: 3,
            height: 120,
            responsive: true,
            hideScrollbar: true,
            interact: true,
            backend: 'MediaElement', // Gunakan MediaElement untuk sinkronisasi yang lebih baik dengan audio HTML
            media: audioPlayer // Hubungkan langsung ke elemen audio HTML
        });

        // Event listener untuk sinkronisasi
        wavesurferInstance.on('interaction', () => {
            if (wavesurferInstance.isPlaying()) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
        });
        // Audio player events sinkron ke wavesurfer
        audioPlayer.addEventListener('play', () => wavesurferInstance.play());
        audioPlayer.addEventListener('pause', () => wavesurferInstance.pause());
        audioPlayer.addEventListener('seeked', () => wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration));
        audioPlayer.addEventListener('timeupdate', () => {
            if (wavesurferInstance.isPlaying()) {
                wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
            }
        });
    };

    generateBtn.addEventListener('click', async () => {
        const lyrics = lyricsInput.value.trim();

        if (!lyrics) {
            alert("Mohon masukkan lirik untuk membuat instrumental!");
            return;
        }

        // Tampilan loading dan nonaktifkan tombol
        generateBtn.disabled = true;
        loadingSpinner.style.display = 'flex';
        musicOutput.style.display = 'none';
        errorMessage.style.display = 'none';

        // Bersihkan konten sebelumnya
        audioPlayer.src = '';
        midiVisualizer.clear();
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null; // Reset instance
        }


        try {
            const response = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: lyrics }),
            });

            if (!response.ok) {
                // Tangani kesalahan HTTP (misalnya 404, 500)
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const base64Wav = data.base64_wav;
            const base64Midi = data.base64_midi;

            if (!base64Wav || !base64Midi) {
                throw new Error("Respons backend tidak lengkap (missing WAV or MIDI data).");
            }

            // Atur audio player
            audioPlayer.src = `data:audio/wav;base64,${base64Wav}`;

            // Atur MIDI visualizer
            midiVisualizer.src = `data:audio/midi;base64,${base64Midi}`;

            // Inisialisasi Wavesurfer dan muat audio
            initOrUpdateWavesurfer();
            wavesurferInstance.load(`data:audio/wav;base64,${base64Wav}`);

            musicOutput.style.display = 'block';
            audioPlayer.play(); // Putar secara otomatis

        } catch (error) {
            console.error('Error generating music:', error);
            errorMessage.textContent = `Terjadi kesalahan: ${error.message || 'Server tidak merespons.'}`;
            errorMessage.style.display = 'block';
        } finally {
            loadingSpinner.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia
    initOrUpdateWavesurfer();
});
