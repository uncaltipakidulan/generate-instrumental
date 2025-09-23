// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner'); // Menggunakan ID yang benar dari HTML
    const musicOutput = document.getElementById('musicOutput');     // Menggunakan ID yang benar dari HTML
    const audioPlayer = document.getElementById('audioPlayer');
    const midiVisualizer = document.getElementById('midiVisualizer');
    const waveformContainer = document.getElementById('waveform');  // Menggunakan ID yang benar dari HTML
    const errorMessage = document.getElementById('errorMessage');   // Menggunakan ID yang benar dari HTML

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
    // PENTING: URL ini akan berubah setiap kali Anda memulai ulang Pinggy di akun gratis.
    // Pastikan untuk selalu menambahkan "/generate-instrumental" di akhir saat fetch.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link'; // Pastikan ini HTTPS!

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
        audioPlayer.addEventListener('seeked', () => {
            if (audioPlayer.duration) { // Pastikan durasi tersedia sebelum mencari
                wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
            }
        });
        audioPlayer.addEventListener('timeupdate', () => {
            if (wavesurferInstance.isPlaying() && audioPlayer.duration) { // Pastikan durasi tersedia
                wavesurferInstance.seekTo(audioPlayer.currentTime / audioPlayer.duration);
            }
        });
    };

    // === Validasi Elemen DOM ===
    // Memastikan semua elemen yang dibutuhkan ada sebelum menambahkan event listener
    if (!lyricsInput || !generateBtn || !loadingSpinner || !musicOutput || !audioPlayer || !midiVisualizer || !waveformContainer || !errorMessage) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar.');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Error: Elemen tidak lengkap';
        }
        // Jangan return di sini agar initOrUpdateWavesurfer tetap dipanggil untuk pertama kali
    }

    // === Event Listener untuk Tombol Generate ===
    generateBtn.addEventListener('click', async () => {
        const lyrics = lyricsInput.value.trim();

        if (!lyrics) {
            errorMessage.textContent = 'Mohon masukkan lirik untuk membuat instrumental!';
            errorMessage.style.display = 'block';
            musicOutput.style.display = 'none'; // Sembunyikan output sebelumnya
            return;
        }

        // Tampilan loading dan nonaktifkan tombol
        generateBtn.disabled = true;
        loadingSpinner.style.display = 'flex'; // Menggunakan flex untuk spinner
        musicOutput.style.display = 'none';    // Sembunyikan hasil sebelumnya
        errorMessage.style.display = 'none';   // Sembunyikan error sebelumnya

        // Bersihkan konten sebelumnya
        audioPlayer.src = '';
        midiVisualizer.src = ''; // Bersihkan visualizer MIDI
        if (wavesurferInstance) {
            wavesurferInstance.empty(); // Kosongkan Wavesurfer
            // wavesurferInstance.destroy(); // Tidak perlu destroy jika hanya ingin mengosongkan
            // wavesurferInstance = null;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: lyrics }),
            });

            if (!response.ok) {
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
            // Pastikan midiVisualizer ada sebelum mengatur src
            if (midiVisualizer) {
                midiVisualizer.src = `data:audio/midi;base64,${base64Midi}`;
            }

            // Inisialisasi Wavesurfer dan muat audio
            initOrUpdateWavesurfer(); // Pastikan Wavesurfer siap
            wavesurferInstance.load(`data:audio/wav;base64,${base64Wav}`); // Muat audio ke Wavesurfer

            musicOutput.style.display = 'block';
            // audioPlayer.play(); // Putar secara otomatis (opsional, bisa dinonaktifkan)

        } catch (error) {
            console.error('Error generating music:', error);
            errorMessage.textContent = `Terjadi kesalahan: ${error.message || 'Server tidak merespons.'}`;
            errorMessage.style.display = 'block';
            musicOutput.style.display = 'none'; // Pastikan output tersembunyi jika ada error
        } finally {
            loadingSpinner.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Instrumental'; // Kembalikan teks tombol
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    // Ini juga penting untuk event listener audioPlayer.
    initOrUpdateWavesurfer();
});
