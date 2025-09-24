// script.js

document.addEventListener('DOMContentLoaded', () => {
    // ... (Mendapatkan referensi ke elemen-elemen DOM) ...

    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link';

    let wavesurferInstance = null;

    // ... (Fungsi initOrUpdateWavesurfer) ...

    // ... (Fungsi hideAllOutput) ...

    // ... (Validasi Elemen DOM) ...

    // === Event Listener untuk Tombol Generate ===
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
        if (audioPlayer.getContext && audioPlayer.getContext().state === 'suspended') {
            audioPlayer.getContext().resume().catch(e => console.warn("Failed to resume HTML audio context:", e));
        }
        // --- AKHIR BAGIAN AUDIO CONTEXT ---


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
                midiVisualizer.src = midiDataURL;
            }
            downloadMidiLink.href = midiDataURL;
            downloadMidiLink.download = 'generated_instrumental.mid';

            // ===========================================
            // TANGANI WAVESURFER
            // ===========================================
            // Pastikan AudioContext Tone.js sudah berjalan sebelum init Wavesurfer
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
            generateBtn.textContent = 'Buat Instrumental';
        }
    });

    // Inisialisasi wavesurfer pertama kali agar elemen tersedia dan WaveSurfer aktif
    initOrUpdateWavesurfer();
});
