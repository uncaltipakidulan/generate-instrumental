// script.js - Final Fixes
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental loaded');
    
    // DOM Elements - PASTIKAN SEMUA ID INI ADA DI HTML ANDA!
    const textInput = document.getElementById('textInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoInput = document.getElementById('tempoInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const audioPlayer = document.getElementById('audioPlayer'); // HTML5 <audio> tag
    const downloadBtn = document.getElementById('downloadBtn');
    const wavesurferContainer = document.getElementById('waveform');
    const statusMsg = document.getElementById('statusMsg');
    const audioSection = document.getElementById('audioSection'); // New: Section containing audio player and waveform
    const playPauseBtn = document.getElementById('playPauseBtn'); // New: Custom play/pause button for Wavesurfer

    // Check if critical elements are missing
    if (!textInput || !generateBtn || !audioPlayer || !statusMsg || !wavesurferContainer || !audioSection) {
        console.error('❌ Critical DOM elements are missing. Please check your index.html for correct IDs.');
        if (statusMsg) statusMsg.textContent = 'Error: Missing HTML elements.';
        if (generateBtn) generateBtn.disabled = true;
        return; // Stop script execution if crucial elements are not found
    }
    
    // State
    let wavesurferInstance = null; // Renamed to avoid confusion with the library itself
    let currentAudioUrl = null;
    let isGenerating = false;
    let audioContext = null;
    
    // Initialize AudioContext with user gesture handling
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('✅ AudioContext initialized');
            } catch (error) {
                console.warn('⚠️ AudioContext not supported:', error);
            }
        }
        return audioContext;
    }
    
    // Resume AudioContext on user interaction
    function resumeAudioContext() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('✅ AudioContext resumed');
            }).catch(err => {
                console.warn('⚠️ Failed to resume AudioContext:', err);
            });
        }
    }
    
    // User gesture handler for audio
    // Only attach these once to avoid multiple listeners
    document.addEventListener('click', resumeAudioContext, { once: true, passive: true });
    document.addEventListener('touchstart', resumeAudioContext, { once: true, passive: true });
    
    // Initialize Wavesurfer with proper error handling
    async function initOrUpdateWavesurfer(audioUrl = null) {
        // Only load Wavesurfer if not already loaded
        if (!wavesurferInstance) {
            try {
                const { WaveSurfer } = await import('https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js');
                wavesurferInstance = WaveSurfer.create({
                    container: wavesurferContainer, // Pass the actual DOM element
                    waveColor: '#4F46E5',
                    progressColor: '#7C3AED',
                    height: 80,
                    barWidth: 2,
                    barRadius: 3,
                    responsive: true,
                    normalize: true,
                    partialRender: false,
                    // Pass the audio element to Wavesurfer
                    media: audioPlayer, 
                    // No need for separate plugins anymore with v7 for minimap/timeline, use regions/annotations
                    plugins: [] 
                });
                
                // Event listeners for the Wavesurfer instance
                wavesurferInstance.on('ready', () => {
                    console.log('✅ Wavesurfer ready');
                    statusMsg.textContent = 'Audio siap diputar 🎵';
                    statusMsg.className = 'text-green-600';
                    playPauseBtn.classList.remove('hidden'); // Show custom play/pause
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = 'Download MP3';
                    audioSection.classList.remove('hidden'); // Show the audio section
                });
                
                wavesurferInstance.on('error', (error) => {
                    console.error('❌ Wavesurfer error:', error);
                    statusMsg.textContent = 'Error loading audio visualizer: ' + error.message;
                    statusMsg.className = 'text-red-600';
                    // Fallback to showing just the HTML5 player
                    audioSection.classList.remove('hidden');
                    playPauseBtn.classList.add('hidden'); // Hide custom button
                });
                
                wavesurferInstance.on('loading', (progress) => {
                    statusMsg.textContent = `Loading visualizer... ${Math.round(progress * 100)}%`;
                });

                wavesurferInstance.on('play', () => audioPlayer.play().catch(e => console.warn('Play failed:', e)));
                wavesurferInstance.on('pause', () => audioPlayer.pause());
                audioPlayer.addEventListener('play', () => wavesurferInstance.play());
                audioPlayer.addEventListener('pause', () => wavesurferInstance.pause());

                // Custom play/pause button logic
                playPauseBtn.addEventListener('click', () => {
                    if (wavesurferInstance.isPlaying()) {
                        wavesurferInstance.pause();
                    } else {
                        wavesurferInstance.play();
                    }
                });
                
                console.log('✅ Wavesurfer instance created');
                
            } catch (error) {
                console.error('❌ Failed to load or initialize Wavesurfer:', error);
                statusMsg.textContent = 'Gagal memuat visualizer audio. Akan menggunakan pemutar audio dasar.';
                statusMsg.className = 'text-yellow-600';
                audioSection.classList.remove('hidden'); // Still show the audio section
                playPauseBtn.classList.add('hidden'); // Hide custom button
                wavesurferInstance = null; // Ensure wavesurferInstance is null if creation failed
            }
        }
        
        // Load audio if URL is provided
        if (wavesurferInstance && audioUrl) {
            // Validate URL
            if (!audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
                console.warn('⚠️ Invalid audio URL for Wavesurfer:', audioUrl);
                return;
            }
            try {
                await wavesurferInstance.load(audioUrl);
                console.log('✅ Wavesurfer loaded audio:', audioUrl);
            } catch (error) {
                console.error('❌ Wavesurfer load audio failed:', error);
                statusMsg.textContent = 'Gagal memuat audio ke visualizer.';
                statusMsg.className = 'text-red-600';
                // Fallback to HTML5 audio only
                audioPlayer.src = audioUrl;
                audioPlayer.load();
                audioSection.classList.remove('hidden');
            }
        } else if (!wavesurferInstance && audioUrl) {
             // If wavesurfer failed to initialize, but we have an audio URL, still show HTML5 player
            audioPlayer.src = audioUrl;
            audioPlayer.load();
            audioSection.classList.remove('hidden');
        }
    }
    
    // Enhanced generate function
    async function generateInstrumental() {
        if (isGenerating) return;
        
        const lyrics = textInput.value.trim();
        const genre = genreSelect.value;
        const tempo = tempoInput.value || 'auto';
        
        if (!lyrics) {
            alert('⚠️ Masukkan lirik atau teks terlebih dahulu!');
            textInput.focus();
            return;
        }
        
        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        loadingSpinner.classList.remove('hidden');
        statusMsg.textContent = 'Mengirim permintaan ke server...';
        statusMsg.className = 'text-blue-600';
        
        // Reset audio players
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
        }
        if (wavesurferInstance) {
            wavesurferInstance.destroy(); // Destroy old instance completely
            wavesurferInstance = null; // Reset instance
        }
        wavesurferContainer.innerHTML = ''; // Clear container for new instance
        
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Download MP3';
        audioSection.classList.add('hidden'); // Hide audio section initially
        playPauseBtn.classList.add('hidden'); // Hide custom play/pause
        
        try {
            const requestData = {
                text: lyrics,
                genre: genre,
                tempo: tempo
            };
            
            console.log('📤 Sending request:', requestData);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // Increased timeout to 90s
            
            const response = await fetch('/generate-instrumental', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('📥 Response received:', result);
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            if (!result.wav_url && !result.midi_url) {
                throw new Error('No audio files returned from server');
            }
            
            currentAudioUrl = result.wav_url || result.midi_url; // Prioritize MP3/WAV
            console.log('🎵 Audio URL:', currentAudioUrl);
            
            // Set HTML5 audio player
            if (audioPlayer && currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                
                audioPlayer.addEventListener('canplay', () => {
                    console.log('✅ Audio can play');
                    statusMsg.textContent = 'Audio siap diputar! Klik play button 🎵';
                    statusMsg.className = 'text-green-600';
                    audioSection.classList.remove('hidden'); // Show the audio section
                }, { once: true });
                
                audioPlayer.addEventListener('error', (e) => {
                    console.error('❌ Audio player error:', e);
                    statusMsg.textContent = 'Error loading audio file';
                    statusMsg.className = 'text-red-600';
                    audioSection.classList.remove('hidden'); // Still show the audio section
                });
            }
            
            // Initialize or update Wavesurfer
            if (currentAudioUrl && (currentAudioUrl.includes('.wav') || currentAudioUrl.includes('.mp3'))) {
                // Delay slightly to ensure browser has started loading the audio
                setTimeout(() => {
                    initOrUpdateWavesurfer(currentAudioUrl); // Pass URL to init/update wavesurfer
                }, 500); 
            } else {
                // If Wavesurfer is not used/failed, ensure audio section is shown
                audioSection.classList.remove('hidden');
                statusMsg.textContent = 'Instrumental berhasil dibuat! 🎉';
                statusMsg.className = 'text-green-600';
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Download MP3';
            }
            
            // Scroll to audio player
            if (audioSection) {
                audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
        } catch (error) {
            console.error('❌ Generate error:', error);
            
            let errorMsg = 'Terjadi kesalahan: ';
            if (error.name === 'AbortError') {
                errorMsg += 'Request timeout (90 detik). Server mungkin sibuk atau lirik terlalu panjang.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMsg += 'Tidak dapat terhubung ke server. Pastikan backend Flask berjalan di port 5000.';
            } else {
                errorMsg += error.message;
            }
            
            statusMsg.textContent = errorMsg;
            statusMsg.className = 'text-red-600';
            alert(errorMsg);
            
        } finally {
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Instrumental 🎵';
            loadingSpinner.classList.add('hidden');
        }
    }
    
    // Download handler
    function downloadAudio() {
        if (!currentAudioUrl) {
            alert('⚠️ Tidak ada file audio untuk di-download!');
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.href = currentAudioUrl;
            
            // Determine filename from URL or default
            let fileName = currentAudioUrl.split('/').pop();
            if (!fileName || fileName.includes('output_')) { // If it's a generic output_UUID.mp3
                fileName = `instrumental_${Date.now()}.${currentAudioUrl.split('.').pop() || 'mp3'}`;
            }
            link.download = fileName;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('📥 Download started:', link.download);
            
        } catch (error) {
            console.error('❌ Download error:', error);
            alert('Gagal mendownload file. Coba klik kanan pada player dan "Save audio as..."');
        }
    }
    
    // Event Listeners
    if (generateBtn) {
        generateBtn.addEventListener('click', generateInstrumental);
    }
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadAudio);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateInstrumental();
        }
        
        // Space to play/pause only if a song is loaded and no input is focused
        if (e.key === ' ' && !textInput.matches(':focus') && (audioPlayer.src || wavesurferInstance)) {
            e.preventDefault();
            if (wavesurferInstance && wavesurferInstance.isPlaying()) {
                wavesurferInstance.pause();
            } else if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
            } else {
                // If audio player is available and not playing, try to play it
                if (audioPlayer.src && audioPlayer.paused) {
                    audioPlayer.play().catch(e => console.warn('Autoplay prevented:', e));
                }
            }
        }
    });
    
    // Form validation on input
    if (textInput) {
        textInput.addEventListener('input', () => {
            const charCount = textInput.value.length;
            const maxLength = 2000;
            
            if (charCount > maxLength) {
                textInput.value = textInput.value.substring(0, maxLength);
                statusMsg.textContent = `Teks dibatasi hingga ${maxLength} karakter`;
                statusMsg.className = 'text-yellow-600';
            } else if (charCount === 0) {
                statusMsg.textContent = 'Masukkan lirik atau deskripsi musik...';
                statusMsg.className = 'text-gray-500';
            } else {
                statusMsg.textContent = `${charCount} karakter`;
                statusMsg.className = 'text-gray-600';
            }
        });
    }
    
    // Initialize on load
    initAudioContext();
    // initOrUpdateWavesurfer(); // No need to call this without an initial audioUrl
    
    // Auto-generate example on first load (optional)
    if (textInput && !textInput.value.trim()) {
        textInput.value = '[verse]\nA beautiful melody with soft piano and gentle strings\n[chorus]\nRising emotions building to a powerful climax';
        statusMsg.textContent = 'Contoh lirik dimuat. Edit dan klik Generate!';
        statusMsg.className = 'text-blue-600';
    }
    
    console.log('🚀 Frontend initialized successfully');
});

// Global error handling (mostly for unhandled promises)
window.addEventListener('error', (event) => {
    console.error('💥 Global error (not caught):', event.error);
    // You can add more sophisticated error reporting here if needed
});

window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection:', event.reason);
    // This often means a promise somewhere rejected and wasn't caught.
    // Sometimes harmless, sometimes indicative of a deeper problem.
});
