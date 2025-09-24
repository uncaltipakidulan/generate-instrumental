// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    
    // Status / Message elements
    const loadingDiv = document.getElementById('loadingDiv');
    const resultDiv = document.getElementById('resultDiv');
    const errorDiv = document.getElementById('errorDiv');
    const errorMessageSpan = document.getElementById('errorMessageSpan');

    // Main output container
    const musicOutputDiv = document.getElementById('musicOutputDiv');
    
    // WAV related elements
    const audioPlayerContainer = document.getElementById('audioPlayerContainer'); // Wadah untuk audio HTML player
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink'); // Download WAV
    // const waveformContainer = document.getElementById('waveform'); // HAPUS karena Wavesurfer sudah dihapus
    
    // MIDI related elements
    const midiPlayerContainer = document.getElementById('midiPlayerContainer');
    const midiPlayer = document.getElementById('midiPlayer'); // The <midi-player> element
    const midiVisualizer = document.getElementById('midiVisualizer'); // The <midi-visualizer> element
    const downloadMidiLink = document.getElementById('downloadMidiLink'); // Download MIDI

    // URL API Pinggy Anda yang sedang aktif dan berfungsi.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link'; // Pastikan ini HTTPS!

    // let wavesurferInstance = null; // HAPUS karena Wavesurfer sudah dihapus

    // Fungsi untuk menginisialisasi atau memperbarui Wavesurfer (HAPUS)
    // const initOrUpdateWavesurfer = () => { ... };

    // Fungsi untuk menyembunyikan semua pesan status dan output
    function hideAllOutput() {
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
            midiPlayer.stop(); // Stop playback (jika ada)
        }
        if (midiVisualizer) {
            midiVisualizer.src = '';
        }
        downloadMidiLink.removeAttribute('href');
        downloadMidiLink.removeAttribute('download');

        // Reset Wavesurfer (HAPUS)
        // if (wavesurferInstance) {
        //     wavesurferInstance.empty();
        // }
    }

    // === Validasi Elemen DOM ===
    // Pastikan semua elemen yang dibutuhkan ada saat DOMContentLoaded
    const requiredElements = [
        lyricsInput, generateBtn, loadingDiv, resultDiv, errorDiv, errorMessageSpan,
        musicOutputDiv, audioPlayerContainer, audioPlayer, downloadLink, // waveformContainer DIHAPUS
        midiPlayerContainer, midiPlayer, midiVisualizer, downloadMidiLink
    ];
    
    // Collect names of missing elements for better debugging
    const missingElements = requiredElements.filter(el => el === null).map(el => el ? el.id : 'N/A');

    if (missingElements.length > 0) {
        console.error('Satu atau lebih elemen DOM tidak ditemukan. Pastikan semua ID HTML benar. Missing:', missingElements.join(', '));
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
            // TANGANI WAV UNTUK DOWNLOAD DAN PEMUTAR HTML STANDAR
            // ===========================================
            const audioDataURL = `data:audio/wav;base64,${base64Wav}`;
            audioPlayer.src = audioDataURL;
            audioPlayer.load(); // Memuat audio
            // audioPlayer.play(); // Putar secara otomatis (opsional)

            downloadLink.href = audioDataURL;
            downloadLink.download = 'generated_instrumental.wav';

            // ===========================================
            // TANGANI MIDI UNTUK MIDI-PLAYER DAN VISUALIZER
            // ===========================================
            const midiDataURL = `data:audio/midi;base64,${base64Midi}`;
            if (midiPlayer) {
                midiPlayer.src = midiDataURL;
                // midi-visualizer akan otomatis diperbarui karena terhubung melalui visualizer="#midiVisualizer"
            }
            if (midiVisualizer) {
                midiVisualizer.src = midiDataURL; // Juga set src di visualizer untuk redundansi
            }
            downloadMidiLink.href = midiDataURL;
            downloadMidiLink.download = 'generated_instrumental.mid';

            // ===========================================
            // WAVESURFER.JS DIHAPUS DARI SINI
            // ===========================================
            // initOrUpdateWavesurfer();
            // wavesurferInstance.load(audioDataURL);

            // Tampilkan seluruh area output musik
            musicOutputDiv.classList.remove('hidden');
            resultDiv.classList.remove('hidden');

            // Opsional: putar MIDI atau WAV secara otomatis
            // if (midiPlayer) { midiPlayer.start(); }
            // audioPlayer.play();

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

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif (HAPUS)
    // initOrUpdateWavesurfer();
});
