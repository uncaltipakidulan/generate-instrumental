// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan referensi ke elemen-elemen DOM
    const lyricsInput = document.getElementById('lyricsInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result'); // Untuk menampilkan pesan sukses atau hasil
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');
    const errorDiv = document.getElementById('error'); // Untuk menampilkan pesan error secara umum
    const errorMessageElem = document.getElementById('errorMessage'); // Untuk detail pesan error

    // --- Tambahan untuk MIDI Visualizer ---
    const midiVisualizer = document.getElementById('midiVisualizer');
    // --- Akhir Tambahan ---

    // URL API ngrok Anda yang sedang aktif dan berfungsi.
    // PENTING: URL ini akan berubah setiap kali Anda memulai ulang ngrok di akun gratis.
    // Pastikan untuk selalu menambahkan "/generate-music" di akhir.
    const BACKEND_API_URL = 'https://dindwwctyp.a.pinggy.link';

    // === Fungsi Pembantu ===
    // Fungsi untuk menyembunyikan semua pesan status (loading, hasil, error)
    function hideAllMessages() {
        loadingDiv.classList.add('hidden');
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        downloadLink.classList.add('hidden'); // Sembunyikan link download juga
        // Bersihkan konten resultDiv dan errorMessageElem setiap kali disembunyikan
        resultDiv.innerHTML = '';
        errorMessageElem.textContent = '';
        
        // --- Tambahan untuk MIDI Visualizer ---
        if (midiVisualizer) {
            midiVisualizer.src = ''; // Bersihkan visualizer saat pesan disembunyikan
            midiVisualizer.classList.add('hidden'); // Sembunyikan visualizer
        }
        // --- Akhir Tambahan ---
    }

    // === Validasi Elemen DOM ===
    // Memastikan semua elemen yang dibutuhkan ada sebelum menambahkan event listener
    if (!lyricsInput || !generateBtn || !loadingDiv || !resultDiv || !audioPlayer || !downloadLink || !errorDiv || !errorMessageElem || !midiVisualizer) { // Tambahkan midiVisualizer
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

        if (lyrics.length === 0) {
            hideAllMessages(); // Sembunyikan pesan lain jika ada
            errorMessageElem.textContent = 'Silakan masukkan lirik atau teks terlebih dahulu!';
            errorDiv.classList.remove('hidden');
            return; // Hentikan eksekusi
        }

        // 1. Sembunyikan semua pesan sebelumnya dan tampilkan loading
        hideAllMessages();
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true; // Nonaktifkan tombol saat memproses
        generateBtn.textContent = 'Membuat Instrumental'; // Beri umpan balik pada tombol

        try {
            // 2. Kirim permintaan POST ke backend
            const response = await fetch(`${BACKEND_API_URL}/generate-music`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: lyrics }), // Mengirim lirik dalam format JSON
            });

            // 3. Periksa apakah respons tidak OK (misalnya status 4xx atau 5xx)
            if (!response.ok) {
                let errorDetails = 'Terjadi kesalahan saat membuat Instrumental.';
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.error || errorData.message || errorDetails;
                } catch (jsonError) {
                    errorDetails = `Error ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorDetails);
            }

            // 4. Jika respons OK, parse data JSON
            const data = await response.json();
            
            // 5. Periksa apakah respons API mengandung data audio yang diharapkan
            // Backend Anda saat ini mengembalikan WAV, bukan MIDI.
            // Untuk visualizer, kita perlu data MIDI.
            // Jika backend Anda juga bisa mengembalikan MIDI, maka gunakan itu.
            // Untuk sementara, kita akan menggunakan WAV untuk audioPlayer dan tidak menampilkan visualizer MIDI
            // Jika Anda ingin visualizer berfungsi, backend perlu mengirimkan juga MIDI base64.
            
            if (data.audio_data && data.audio_mime_type) {
                // Untuk audio player (WAV)
                const audioDataURL = `data:${data.audio_mime_type};base64,${data.audio_data}`;
                audioPlayer.src = audioDataURL;
                audioPlayer.load();
                audioPlayer.play();
                
                downloadLink.href = audioDataURL;
                downloadLink.download = `generated_instrumental.${data.audio_mime_type.split('/')[1] || 'wav'}`; 
                
                resultDiv.innerHTML = 'Instrumental berhasil dibuat! Putar atau Download di bawah.';
                resultDiv.classList.remove('hidden');
                downloadLink.classList.remove('hidden');

                // --- Penting: Bagian untuk Visualizer ---
                // Saat ini, backend Anda hanya mengembalikan WAV.
                // html-midi-player membutuhkan data MIDI untuk visualisasi.
                // Jika Anda ingin visualizer berfungsi, Anda perlu memodifikasi backend Anda
                // untuk juga mengembalikan MIDI Base64 dalam respons.
                // Misalnya, `data.midi_data` dan `data.midi_mime_type`.

                // CONTOH JIKA BACKEND MENGIRIM MIDI:
                /*
                if (data.midi_data && data.midi_mime_type) {
                    const midiDataURL = `data:${data.midi_mime_type};base64,${data.midi_data}`;
                    midiVisualizer.src = midiDataURL;
                    midiVisualizer.classList.remove('hidden'); // Tampilkan visualizer
                } else {
                    console.warn('Backend tidak menyediakan data MIDI untuk visualizer.');
                    midiVisualizer.src = ''; // Pastikan visualizer kosong
                    midiVisualizer.classList.add('hidden');
                }
                */
                // Karena backend Anda hanya menghasilkan WAV, kita tidak bisa langsung mengisi midiVisualizer.
                // Oleh karena itu, kita akan pastikan visualizer tetap tersembunyi.
                midiVisualizer.src = ''; // Kosongkan jika ada data sebelumnya
                midiVisualizer.classList.add('hidden'); // Pastikan tetap tersembunyi
                // --- Akhir Bagian Visualizer ---

            } else {
                throw new Error('Respons API tidak mengandung data audio atau tipe MIME yang diharapkan.');
            }

        } catch (error) {
            console.error('Error:', error);
            errorMessageElem.textContent = error.message;
            errorDiv.classList.remove('hidden');
            // Pastikan visualizer juga dibersihkan/disembunyikan saat ada error
            if (midiVisualizer) {
                midiVisualizer.src = '';
                midiVisualizer.classList.add('hidden');
            }
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Instrumental'; // Kembalikan teks ke awal
        }
    });
});
