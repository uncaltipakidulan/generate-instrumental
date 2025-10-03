// script.js - Fixed version for generate-instrumental
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Generate Instrumental loaded');
    
    // DOM Elements
    const textInput = document.getElementById('textInput');
    const genreSelect = document.getElementById('genreSelect');
    const tempoInput = document.getElementById('tempoInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadBtn = document.getElementById('downloadBtn');
    const wavesurferContainer = document.getElementById('waveform');
    const statusMsg = document.getElementById('statusMsg');
    
    // State
    let wavesurfer = null;
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
    document.addEventListener('click', resumeAudioContext, { once: true, passive: true });
    document.addEventListener('touchstart', resumeAudioContext, { once: true, passive: true });
    
    // Initialize Wavesurfer with proper error handling
    function initWavesurfer() {
        if (wavesurfer) {
            wavesurfer.destroy();
        }
        
        // Check if container exists
        if (!wavesurferContainer) {
            console.warn('⚠️ Wavesurfer container not found');
            return null;
        }
        
        try {
            // Import Wavesurfer v7
            import('https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js').then(({ WaveSurfer }) => {
                wavesurfer = WaveSurfer.create({
                    container: '#waveform',
                    waveColor: '#4F46E5',
                    progressColor: '#7C3AED',
                    height: 80,
                    barWidth: 2,
                    barRadius: 3,
                    responsive: true,
                    normalize: true,
                    partialRender: false,
                    // Disable plugins that might not be available
                    plugins: []
                });
                
                // Event listeners
                wavesurfer.on('ready', () => {
                    console.log('✅ Wavesurfer ready');
                    statusMsg.textContent = 'Audio siap diputar 🎵';
                    statusMsg.className = 'text-green-600';
                });
                
                wavesurfer.on('error', (error) => {
                    console.error('❌ Wavesurfer error:', error);
                    statusMsg.textContent = 'Error loading audio: ' + error.message;
                    statusMsg.className = 'text-red-600';
                });
                
                wavesurfer.on('loading', (progress) => {
                    statusMsg.textContent = `Loading audio... ${Math.round(progress * 100)}%`;
                });
                
                // Sync with HTML5 audio player
                wavesurfer.on('play', () => {
                    if (audioPlayer) audioPlayer.play().catch(e => console.warn('Play failed:', e));
                });
                
                wavesurfer.on('pause', () => {
                    if (audioPlayer) audioPlayer.pause();
                });
                
                console.log('✅ Wavesurfer initialized');
                
            }).catch(error => {
                console.error('❌ Failed to load Wavesurfer:', error);
                statusMsg.textContent = 'Failed to load audio visualizer';
                statusMsg.className = 'text-yellow-600';
            });
            
        } catch (error) {
            console.error('❌ Wavesurfer initialization error:', error);
            return null;
        }
        
        return wavesurfer;
    }
    
    // Update Wavesurfer with new audio source
    function updateWavesurfer(audioUrl) {
        if (!wavesurfer || !audioUrl) {
            console.warn('⚠️ Cannot update Wavesurfer: no instance or URL');
            return;
        }
        
        // Validate URL
        if (!audioUrl.startsWith('http') && !audioUrl.startsWith('/')) {
            console.warn('⚠️ Invalid audio URL:', audioUrl);
            return;
        }
        
        try {
            // Destroy existing if needed
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            }
            
            // Load new audio with error handling
            wavesurfer.load(audioUrl).then(() => {
                console.log('✅ Wavesurfer loaded:', audioUrl);
                statusMsg.textContent = 'Audio loaded successfully 🎵';
                statusMsg.className = 'text-green-600';
                
                // Enable controls
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Download MP3';
                
            }).catch(error => {
                console.error('❌ Wavesurfer load failed:', error);
                statusMsg.textContent = 'Failed to load audio for visualizer';
                statusMsg.className = 'text-red-600';
                
                // Fallback to HTML5 audio only
                if (audioPlayer) {
                    audioPlayer.src = audioUrl;
                    audioPlayer.load();
                }
            });
            
        } catch (error) {
            console.error('❌ Error updating Wavesurfer:', error);
        }
    }
    
    // Enhanced generate function with better error handling
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
        
        // Reset audio
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer.src = '';
        }
        
        if (wavesurfer) {
            wavesurfer.pause();
            wavesurfer.empty();
        }
        
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Download MP3';
        
        try {
            // Prepare request data
            const requestData = {
                text: lyrics,
                genre: genre,
                tempo: tempo
            };
            
            console.log('📤 Sending request:', requestData);
            
            // Make API request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
            
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
            
            // Handle audio URL
            currentAudioUrl = result.wav_url || result.midi_url;
            console.log('🎵 Audio URL:', currentAudioUrl);
            
            // Set HTML5 audio player
            if (audioPlayer && currentAudioUrl) {
                audioPlayer.src = currentAudioUrl;
                audioPlayer.load();
                
                // Auto-play after user gesture (don't autoplay immediately)
                audioPlayer.addEventListener('canplay', () => {
                    console.log('✅ Audio can play');
                    statusMsg.textContent = 'Audio siap diputar! Klik play button 🎵';
                    statusMsg.className = 'text-green-600';
                }, { once: true });
                
                audioPlayer.addEventListener('error', (e) => {
                    console.error('❌ Audio player error:', e);
                    statusMsg.textContent = 'Error loading audio file';
                    statusMsg.className = 'text-red-600';
                });
            }
            
            // Update Wavesurfer
            if (currentAudioUrl && currentAudioUrl.includes('.wav') || currentAudioUrl.includes('.mp3')) {
                setTimeout(() => {
                    updateWavesurfer(currentAudioUrl);
                }, 500); // Small delay to ensure server has served the file
            } else {
                console.warn('⚠️ Audio format not supported by Wavesurfer:', currentAudioUrl);
            }
            
            // Update UI
            statusMsg.textContent = 'Instrumental berhasil dibuat! 🎉';
            statusMsg.className = 'text-green-600';
            
            // Scroll to audio player
            const audioSection = document.getElementById('audioSection');
            if (audioSection) {
                audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
        } catch (error) {
            console.error('❌ Generate error:', error);
            
            let errorMsg = 'Terjadi kesalahan: ';
            if (error.name === 'AbortError') {
                errorMsg += 'Request timeout (60 detik). Coba lagi dengan lirik yang lebih pendek.';
            } else if (error.message.includes('NetworkError')) {
                errorMsg += 'Tidak dapat terhubung ke server. Pastikan backend Flask berjalan.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMsg += 'Server tidak merespons. Periksa apakah Flask berjalan di port 5000.';
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
            // Create download link
            const link = document.createElement('a');
            link.href = currentAudioUrl;
            link.download = `instrumental_${Date.now()}.mp3`; // Default to MP3
            
            // Try to get proper filename from URL
            if (currentAudioUrl.includes('.mp3')) {
                link.download = currentAudioUrl.split('/').pop() || `instrumental_${Date.now()}.mp3`;
            } else if (currentAudioUrl.includes('.wav')) {
                link.download = currentAudioUrl.split('/').pop() || `instrumental_${Date.now()}.wav`;
            } else if (currentAudioUrl.includes('.mid')) {
                link.download = currentAudioUrl.split('/').pop() || `instrumental_${Date.now()}.mid`;
            }
            
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
        // Ctrl/Cmd + Enter to generate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateInstrumental();
        }
        
        // Space to play/pause
        if (e.key === ' ' && (audioPlayer || wavesurfer)) {
            e.preventDefault();
            if (wavesurfer && wavesurfer.isPlaying()) {
                wavesurfer.pause();
            } else if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
            } else {
                if (wavesurfer) wavesurfer.play();
                else if (audioPlayer) audioPlayer.play().catch(console.warn);
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
    initWavesurfer();
    
    // Auto-generate example on first load (optional)
    if (!textInput.value.trim()) {
        textInput.value = '[verse]\nA beautiful melody with soft piano and gentle strings\n[chorus]\nRising emotions building to a powerful climax';
        statusMsg.textContent = 'Contoh lirik dimuat. Edit dan klik Generate!';
        statusMsg.className = 'text-blue-600';
    }
    
    console.log('🚀 Frontend initialized successfully');
});

// Utility function for better error reporting
window.addEventListener('error', (event) => {
    console.error('💥 Global error:', event.error);
    // Don't show alert for non-critical errors
    if (!event.error.message.includes('clearMessagesCache') && 
        !event.error.message.includes('moz-osx-font-smoothing') &&
        !event.error.message.includes('webkit-text-size-adjust')) {
        // Only show critical errors
        console.warn('Non-critical error logged:', event.error.message);
    }
});

// Prevent console errors from breaking functionality
window.addEventListener('unhandledrejection', (event) => {
    console.warn('⚠️ Unhandled promise rejection:', event.reason);
    event.preventDefault();
});
