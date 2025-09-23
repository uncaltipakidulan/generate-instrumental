// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const musicOutputDiv = document.getElementById('musicOutput');
    
    // Elemen untuk WAV (tetap ada untuk download dan Wavesurfer)
    const audioPlayerContainer = document.getElementById('audioPlayerContainer'); // Wadah untuk audio HTML player
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink'); 
    const waveformContainer = document.getElementById('waveform');
    
    // Elemen untuk MIDI Player baru
    const midiPlayerContainer = document.getElementById('midiPlayerContainer'); // Wadah untuk midi-player
    const midiPlayer = document.getElementById('midiPlayer'); // Elemen <midi-player>
    const midiVisualizer = document.getElementById('midiVisualizer'); // Elemen <midi-visualizer>
    const downloadMidiLink = document.getElementById('downloadMidiLink'); // Link download MIDI baru

    const errorDiv = document.getElementById('error');
    const errorMessageSpan = document.getElementById('errorMessage');

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link'; // Pastikan ini HTTPS!

    let wavesurferInstance = null; // Instans Wavesurfer

    // Fungsi untuk menginisialisasi atau memperbarui Wavesurfer
    const initOrUpdateWavesurfer = () => {
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
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
            media: audioPlayer // Tetap hubungkan ke elemen audio HTML standar untuk sinkronisasi
        });

        // Event listener untuk sinkronisasi pemutaran dengan Wavesurfer
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
        musicOutputDiv.classList.add('hidden'); // Sembunyikan seluruh output musik
        
        // Bersihkan konten dan sumber
        errorMessageSpan.textContent = '';
        audioPlayer.src = '';
        downloadLink.removeAttribute('href');
        downloadLink.removeAttribute('download');

        if (midiPlayer) { // Bersihkan midi-player
            midiPlayer.src = '';
            midiPlayer.classList.add('hidden');
        }
        if (midiVisualizer) { // Bersihkan midi-visualizer
            midiVisualizer.src = '';
            midiVisualizer.classList.add('hidden');
        }
        downloadMidiLink.removeAttribute('href');
        downloadMidiLink.removeAttribute('download');

        if (wavesurferInstance) {
            wavesurferInstance.empty();
        }
    }

    // === Validasi Elemen DOM ===
    const requiredElements = [
        lyricsInput, generateBtn, loadingDiv, resultDiv, musicOutputDiv,
        audioPlayerContainer, audioPlayer, downloadLink, waveformContainer,
        midiPlayerContainer, midiPlayer, midiVisualizer, downloadMidiLink, // Elemen MIDI baru
        errorDiv, errorMessageSpan
    ];
    const allElementsFound = requiredElements.every(el => el !== null);

    if (!allElementsFound) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar.');
        console.log('Missing elements:', requiredElements.filter(el => el === null).map(el => el.id || 'N/A'));
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

            // ===========================================
            // TANGANI WAV UNTUK DOWNLOAD DAN WAVESURFER
            // ===========================================
            const audioDataURL = `data:audio/wav;base64,${base64Wav}`;
            audioPlayer.src = audioDataURL; // Tetap set ke audioPlayer HTML standar untuk Wavesurfer
            audioPlayer.load();

            downloadLink.href = audioDataURL;
            downloadLink.download = 'generated_instrumental.wav';

            // ===========================================
            // TANGANI MIDI UNTUK MIDI-PLAYER DAN VISUALIZER
            // ===========================================
            const midiDataURL = `data:audio/midi;base64,${base64Midi}`;
            if (midiPlayer) {
                midiPlayer.src = midiDataURL; // Set src untuk <midi-player>
                midiPlayer.classList.remove('hidden');
                // midi-visualizer akan otomatis diperbarui karena terhubung melalui visualizer="#midiVisualizer"
            }
            if (midiVisualizer) {
                midiVisualizer.classList.remove('hidden');
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

            // Aktifkan pemutar MIDI secara otomatis (opsional)
            // if (midiPlayer) { midiPlayer.start(); }

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

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia
    initOrUpdateWavesurfer();
});
