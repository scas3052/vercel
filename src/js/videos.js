document.addEventListener('DOMContentLoaded', () => {
  // Function to extract video ID from YouTube URL
  function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  // Function to create thumbnail element
  function createThumbnail(videoId) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'thumbnail-container';
    thumbnailContainer.innerHTML = `
      <img src="${thumbnailUrl}" alt="Video thumbnail" class="video-thumbnail-img" loading="lazy">
      <button class="play-button">
        <i class="fas fa-play"></i>
      </button>
    `;
    return thumbnailContainer;
  }

  // Replace iframes with thumbnails initially
  const videoContainers = document.querySelectorAll('.video-thumbnail');
  videoContainers.forEach(container => {
    const iframe = container.querySelector('iframe');
    const url = iframe.getAttribute('src');
    const videoId = getYouTubeVideoId(url);
    
    if (videoId) {
      // Store the iframe URL for later use
      container.dataset.videoUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&showinfo=0&modestbranding=1`;
      
      // Replace iframe with thumbnail
      const thumbnail = createThumbnail(videoId);
      container.innerHTML = '';
      container.appendChild(thumbnail);
    }
  });

  // Initialize players object to store all YouTube players
  const players = {};
  let currentlyPlaying = null;

  // Load YouTube API
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // Function to create YouTube player
  function createYouTubePlayer(container, videoUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = videoUrl;
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    
    container.innerHTML = '';
    container.appendChild(iframe);

    const videoId = getYouTubeVideoId(videoUrl);
    return new YT.Player(iframe, {
      videoId: videoId,
      events: {
        'onStateChange': onPlayerStateChange
      }
    });
  }

  // Handle thumbnail clicks
  document.addEventListener('click', (e) => {
    const playButton = e.target.closest('.play-button');
    if (!playButton) return;

    const container = playButton.closest('.video-thumbnail');
    const section = container.closest('.video-section');
    
    if (section && section.classList.contains('collapsed')) {
      return;
    }

    const videoUrl = container.dataset.videoUrl;
    if (!videoUrl) return;

    // Stop current video if playing
    stopCurrentVideo();

    // Create new player
    const videoId = getYouTubeVideoId(videoUrl);
    if (!players[videoId]) {
      players[videoId] = createYouTubePlayer(container, videoUrl);
      currentlyPlaying = container;
    }
  });

  // Function to stop currently playing video
  function stopCurrentVideo() {
    if (currentlyPlaying) {
      const container = currentlyPlaying;
      const videoUrl = container.dataset.videoUrl;
      const videoId = getYouTubeVideoId(videoUrl);
      
      if (players[videoId]) {
        players[videoId].stopVideo();
        
        // Replace player with thumbnail
        const thumbnail = createThumbnail(videoId);
        container.innerHTML = '';
        container.appendChild(thumbnail);
        
        delete players[videoId];
      }
      currentlyPlaying = null;
    }
  }

  // Handle player state changes
  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      const iframe = event.target.getIframe();
      const currentContainer = iframe.closest('.video-thumbnail');
      const currentSection = currentContainer.closest('.video-section');
      
      if (currentSection && currentSection.classList.contains('collapsed')) {
        event.target.stopVideo();
        return;
      }
      
      if (currentlyPlaying && currentlyPlaying !== currentContainer) {
        stopCurrentVideo();
      }
      
      currentlyPlaying = currentContainer;
    }
  }

  // Section collapse functionality
  const sections = document.querySelectorAll('.video-section');
  const header = document.querySelector('header');
  const headerHeight = header ? header.offsetHeight : 120;

  sections.forEach((section, index) => {
    const sectionHeader = section.querySelector('.section-header');
    
    if (sectionHeader) {
      sectionHeader.addEventListener('click', (e) => {
        e.preventDefault();
        const isCollapsed = section.classList.contains('collapsed');
        
        stopCurrentVideo();
        
        sections.forEach(s => {
          s.classList.add('collapsed');
        });
        
        if (isCollapsed) {
          section.classList.remove('collapsed');
          
          if (index >= 1) {
            const sectionRect = section.getBoundingClientRect();
            if (sectionRect.top < headerHeight) {
              window.scrollTo({
                top: window.scrollY + sectionRect.top - headerHeight - 20,
                behavior: 'smooth'
              });
            }
          }
        }
      });
    }
  });

  // Initially collapse all sections
  sections.forEach(section => {
    section.classList.add('collapsed');
  });

  // Search functionality
  const songSearch = document.getElementById('songSearch');
  const messageSearch = document.getElementById('messageSearch');
  const songCards = document.querySelectorAll('.songs-section .video-card');
  const messageCards = document.querySelectorAll('.messages-section .video-card');

  function filterCards(searchInput, cards) {
    const searchTerm = searchInput.value.toLowerCase();
    let hasResults = false;

    cards.forEach(card => {
      const title = card.querySelector('h3').textContent.toLowerCase();
      const singer = card.querySelector('.singer')?.textContent.toLowerCase() || '';
      const speaker = card.querySelector('.speaker')?.textContent.toLowerCase() || '';
      const isVisible = title.includes(searchTerm) || 
                       singer.includes(searchTerm) || 
                       speaker.includes(searchTerm);
      
      if (!isVisible && card.contains(currentlyPlaying)) {
        stopCurrentVideo();
      }
      
      card.style.display = isVisible ? 'block' : 'none';
      if (isVisible) hasResults = true;
    });

    const section = searchInput.closest('.video-section');
    const noResults = section.querySelector('.no-results') || createNoResultsElement(section);
    noResults.classList.toggle('show', !hasResults);
  }

  function createNoResultsElement(section) {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.textContent = 'No videos found matching your search';
    section.querySelector('.video-grid').after(noResults);
    return noResults;
  }

  if (songSearch) {
    songSearch.addEventListener('input', () => filterCards(songSearch, songCards));
  }

  if (messageSearch) {
    messageSearch.addEventListener('input', () => filterCards(messageSearch, messageCards));
  }

  // Category filtering
  const categoryButtons = document.querySelectorAll('.category-btn');
  
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.closest('.video-section');
      section.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      button.classList.add('active');
      const selectedCategory = button.dataset.category;
      
      const videos = section.querySelectorAll('.video-card');
      let hasResults = false;

      videos.forEach(video => {
        const categories = video.dataset.category.split(' ');
        const isVisible = selectedCategory === 'all-songs' || 
                         selectedCategory === 'all-messages' || 
                         categories.includes(selectedCategory);
        
        if (!isVisible && video.contains(currentlyPlaying)) {
          stopCurrentVideo();
        }
        
        video.style.display = isVisible ? 'block' : 'none';
        if (isVisible) {
          video.style.animation = 'fadeIn 0.5s ease forwards';
          hasResults = true;
        }
      });

      const noResults = section.querySelector('.no-results') || createNoResultsElement(section);
      noResults.classList.toggle('show', !hasResults);
    });
  });

  // Handle page visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCurrentVideo();
    }
  });
  // Add these functions to the existing videos.js file, just before the DOMContentLoaded event listener

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sortByLatest(cards) {
  return Array.from(cards).sort((a, b) => {
    const dateA = a.querySelector('.message-date')?.textContent || '';
    const dateB = b.querySelector('.message-date')?.textContent || '';
    return new Date(dateB) - new Date(dateA);
  });
}

// Add this code inside the DOMContentLoaded event listener, after the category filtering code

// Add control buttons to sections
document.querySelectorAll('.video-section').forEach(section => {
  const sectionContent = section.querySelector('.section-content');
  const searchBox = section.querySelector('.search-box');
  
  const controls = document.createElement('div');
  controls.className = 'video-controls';
  
  const latestBtn = document.createElement('button');
  latestBtn.className = 'control-btn';
  latestBtn.innerHTML = '<i class="fas fa-clock"></i> Latest';
  
  const shuffleBtn = document.createElement('button');
  shuffleBtn.className = 'control-btn';
  shuffleBtn.innerHTML = '<i class="fas fa-random"></i> Shuffle';
  
  controls.appendChild(latestBtn);
  controls.appendChild(shuffleBtn);
  
  searchBox.after(controls);
  
  const videoGrid = section.querySelector('.video-grid');
  const cards = videoGrid.querySelectorAll('.video-card');
  
  shuffleBtn.addEventListener('click', () => {
    stopCurrentVideo();
    const shuffledCards = shuffleArray(Array.from(cards));
    videoGrid.innerHTML = '';
    shuffledCards.forEach(card => videoGrid.appendChild(card));
  });
  
  latestBtn.addEventListener('click', () => {
    stopCurrentVideo();
    const sortedCards = sortByLatest(cards);
    videoGrid.innerHTML = '';
    sortedCards.forEach(card => videoGrid.appendChild(card));
  });
});
});