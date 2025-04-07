document.addEventListener('DOMContentLoaded', function() {
  // Existing chapter functionality
  setTimeout(() => {
    const chapters = document.querySelectorAll('.chapter');
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 120;
    
    if (chapters.length > 0) {
      chapters.forEach((chapter, index) => {
        const chapterHeader = chapter.querySelector('.chapter-header');
        
        if (chapterHeader) {
          chapterHeader.addEventListener('click', (e) => {
            e.preventDefault();
            const isActive = chapter.classList.contains('active');
            
            // Close all chapters
            chapters.forEach(ch => {
              ch.classList.remove('active');
            });
            
            // Toggle current chapter
            if (!isActive) {
              chapter.classList.add('active');
              
              // Apply scrolling animation for all chapters except the first one
              if (index >= 1) {
                const chapterRect = chapter.getBoundingClientRect();
                if (chapterRect.top < headerHeight) {
                  window.scrollTo({
                    top: window.scrollY + chapterRect.top - headerHeight - 20,
                    behavior: 'smooth'
                  });
                }
              }
            }
          });
        }
      });
      
      // All chapters start collapsed by default
      chapters.forEach(ch => {
        ch.classList.remove('active');
      });
    }
  }, 100);

  // Audio player functionality
  const audioPlayers = document.querySelectorAll('.audio-player');
  let currentlyPlaying = null;

  audioPlayers.forEach(player => {
    const audio = player.querySelector('audio');
    const playBtn = player.querySelector('.audio-play-btn');
    const progressBar = player.querySelector('.audio-progress-bar');
    const progress = player.querySelector('.audio-progress');
    const timeDisplay = player.querySelector('.audio-time');
    const container = player.closest('.audio-container');

    // Format time in MM:SS
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Update progress bar and time display
    function updateProgress() {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.style.width = `${percent}%`;
      timeDisplay.textContent = formatTime(audio.currentTime);
    }

    // Handle play/pause
    playBtn.addEventListener('click', () => {
      if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
        currentlyPlaying.closest('.audio-container').classList.remove('playing');
      }

      if (audio.paused) {
        audio.play();
        container.classList.add('playing');
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        currentlyPlaying = audio;
      } else {
        audio.pause();
        container.classList.remove('playing');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        currentlyPlaying = null;
      }
    });

    // Handle progress bar click
    progress.addEventListener('click', (e) => {
      const rect = progress.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
    });

    // Update progress as audio plays
    audio.addEventListener('timeupdate', updateProgress);

    // Reset when audio ends
    audio.addEventListener('ended', () => {
      container.classList.remove('playing');
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      progressBar.style.width = '0%';
      timeDisplay.textContent = '0:00';
      currentlyPlaying = null;
    });

    // Initial time display
    timeDisplay.textContent = '0:00';
  });
});