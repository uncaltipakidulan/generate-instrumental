// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading'); // Menggunakan ID yang benar dari HTML
    const resultDiv = document.getElementById('result');   // Menggunakan ID yang benar dari HTML
    const musicOutputDiv = document.getElementById('musicOutput'); // Wadah utama untuk output musik
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink'); // Menggunakan ID yang benar dari HTML
    const midiVisualizer = document.getElementById('midiVisualizer');
    const waveformContainer = document.getElementById('waveform'); // Menggunakan ID yang benar dari HTML
    const errorDiv = document.getElementById('error');     // Menggunakan ID yang benar dari HTML
    const errorMessageSpan = document.getElementById('errorMessage'); // Menggunakan ID yang benar dari HTML

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
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

    // Fungsi untuk menyembunyikan semua pesan status dan output
    function hideAllOutput() {
        loadingDiv.classList.add('hidden');
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        musicOutputDiv.classList.add('hidden'); // Sembunyikan seluruh output musik
        
        // Bersihkan konten dan sumber
        resultDiv.innerHTML = '';
        errorMessageSpan.textContent = '';
        audioPlayer.src = '';
        if (midiVisualizer) {
            midiVisualizer.src = '';
        }
        if (wavesurferInstance) {
            wavesurferInstance.empty();
        }
    }

    // === Validasi Elemen DOM ===
    // Memastikan semua elemen yang dibutuhkan ada sebelum menambahkan event listener
    const requiredElements = [
        lyricsInput, generateBtn, loadingDiv, resultDiv, musicOutputDiv,
        audioPlayer, downloadLink, midiVisualizer, waveformContainer,
        errorDiv, errorMessageSpan
    ];
    const allElementsFound = requiredElements.every(el => el !== null);

    if (!allElementsFound) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar.');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Error: Elemen tidak lengkap';
        }
        return; // Hentikan eksekusi jika elemen penting tidak ada
    }

    // === Event Listener untuk Tombol Generate ===
    generateBtn.addEventListener('click', async () => {
        const lyrics = lyricsInput.value.trim();

        if (!lyrics) {
            hideAllOutput(); // Sembunyikan output lain jika ada
            errorMessageSpan.textContent = 'Mohon masukkan lirik untuk membuat instrumental!';
            errorDiv.classList.remove('hidden');
            return;
        }

        // 1. Sembunyikan semua pesan sebelumnya dan tampilkan loading
        hideAllOutput();
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true; // Nonaktifkan tombol saat memproses
        generateBtn.textContent = 'Membuat Instrumental...'; // Beri umpan balik pada tombol

        try {
            const response = await fetch(`${BACKEND_API_URL}/generate-instrumental`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: lyrics }),
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

            // Atur audio player
            const audioDataURL = `data:audio/wav;base64,${base64Wav}`;
            audioPlayer.src = audioDataURL;
            audioPlayer.load(); // Memuat audio
            // audioPlayer.play(); // Putar secara otomatis (opsional)

            // Atur link download
            downloadLink.href = audioDataURL;
            downloadLink.download = 'generated_instrumental.wav';

            // Atur MIDI visualizer
            if (midiVisualizer) {
                midiVisualizer.src = `data:audio/midi;base64,${base64Midi}`;
            }

            // Inisialisasi Wavesurfer dan muat audio
            initOrUpdateWavesurfer(); // Pastikan Wavesurfer siap
            wavesurferInstance.load(audioDataURL); // Muat audio ke Wavesurfer

            // Tampilkan hasil
            resultDiv.classList.remove('hidden');
            musicOutputDiv.classList.remove('hidden');

        } catch (error) {
            console.error('Error generating music:', error);
            errorMessageSpan.textContent = `Terjadi kesalahan: ${error.message || 'Server tidak merespons.'}`;
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Instrumental'; // Kembalikan teks tombol
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    initOrUpdateWavesurfer();
});
