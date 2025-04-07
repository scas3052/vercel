// DOM Elements
const regionBtns = document.querySelectorAll('.region-btn');
const districtSections = document.querySelectorAll('.district-section');
const searchInput = document.getElementById('churchSearch');
const locationCards = document.querySelectorAll('.location-card');
const noResults = document.querySelector('.no-results');
const districtHeaders = document.querySelectorAll('.district-header');

// Keep track of current region
let currentRegion = 'all';

// Function to get text content for sorting
function getTextContent(element, selector) {
  return element.querySelector(selector)?.textContent.trim().toLowerCase() || '';
}

// Function to sort alphabetically
function sortAlphabetically() {
  const sections = Array.from(document.querySelectorAll('.district-section'));
  const mainContent = sections[0].parentElement;

  // Sort sections alphabetically by state name
  sections.sort((a, b) => {
    const stateA = getTextContent(a, '.state-title');
    const stateB = getTextContent(b, '.state-title');
    return stateA.localeCompare(stateB);
  });

  // Sort districts within each section
  sections.forEach(section => {
    const districts = Array.from(section.querySelectorAll('.district-container'));
    
    districts.sort((a, b) => {
      const districtA = getTextContent(a, '.district-header h3');
      const districtB = getTextContent(b, '.district-header h3');
      return districtA.localeCompare(districtB);
    });

    // Sort churches within each district
    districts.forEach(district => {
      const grid = district.querySelector('.locations-grid');
      const cards = Array.from(grid.querySelectorAll('.location-card'));
      
      cards.sort((a, b) => {
        const churchA = getTextContent(a, '.location-title');
        const churchB = getTextContent(b, '.location-title');
        return churchA.localeCompare(churchB);
      });

      // Reappend cards in sorted order
      cards.forEach(card => grid.appendChild(card));
    });

    // Reappend districts in sorted order
    districts.forEach(district => section.appendChild(district));
  });

  // Reappend sections in sorted order
  sections.forEach(section => mainContent.appendChild(section));
}

// Function to collapse all districts
function collapseAllDistricts() {
  document.querySelectorAll('.district-container').forEach(container => {
    container.classList.add('collapsed');
    container.querySelector('.district-header').classList.add('collapsed');
  });
}

// Function to update church counts
function updateChurchCounts() {
  document.querySelectorAll('.district-container').forEach(container => {
    const visibleCards = Array.from(container.querySelectorAll('.location-card')).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    ).length;
    container.querySelector('.church-count').textContent = `${visibleCards} ${visibleCards === 1 ? 'Church' : 'Churches'}`;
  });
}

function filterByRegionAndSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const hasSearchTerm = searchTerm.length > 0;
  let hasResults = false;

  // Show/hide directory sections based on region
  document.querySelectorAll('.directory-section').forEach(section => {
    const shouldShowRegion = currentRegion === 'all' || section.dataset.region === currentRegion;
    section.style.display = shouldShowRegion ? 'block' : 'none';
  });

  // Show/hide sections based on region and search results
  document.querySelectorAll('.district-section').forEach(section => {
    const shouldShowRegion = currentRegion === 'all' || section.dataset.region === currentRegion;
    
    if (!shouldShowRegion) {
      section.style.display = 'none';
      return;
    }

    // Check if this section has any matching cards
    const hasMatchingCards = Array.from(section.querySelectorAll('.location-card')).some(card => {
      if (hasSearchTerm) {
        return isCardMatch(card, searchTerm);
      }
      return true;
    });

    // Only show section if it has matching cards
    section.style.display = hasMatchingCards ? 'block' : 'none';
    if (hasMatchingCards) hasResults = true;
  });

  // Filter cards based on search term
  locationCards.forEach(card => {
    const cardSection = card.closest('.district-section');
    const isInSelectedRegion = currentRegion === 'all' || cardSection.dataset.region === currentRegion;
    
    if (!isInSelectedRegion) {
      card.style.display = 'none';
      return;
    }

    if (hasSearchTerm) {
      const isMatch = isCardMatch(card, searchTerm);
      card.style.display = isMatch ? 'block' : 'none';
    } else {
      card.style.display = 'block';
    }
  });

  // Update district containers and counts
  updateDistrictVisibility();
  updateChurchCounts();
  
  // Show/hide no results message
  noResults.classList.toggle('show', !hasResults);

  // If there's a search term, expand matching districts
  if (hasSearchTerm) {
    expandMatchingDistricts();
  } else {
    collapseAllDistricts();
  }
}

function isCardMatch(card, searchTerm) {
  const churchName = card.querySelector('.location-title').textContent.toLowerCase();
  const address = card.querySelector('.detail-item:nth-child(1) span').textContent.toLowerCase();
  const phone = card.querySelector('.detail-item:nth-child(2) span').textContent.toLowerCase();
  const pastor = card.querySelector('.pastor-info span').textContent.toLowerCase();

  return churchName.includes(searchTerm) || 
         address.includes(searchTerm) || 
         phone.includes(searchTerm) || 
         pastor.includes(searchTerm);
}

function updateDistrictVisibility() {
  document.querySelectorAll('.district-container').forEach(container => {
    const visibleCards = Array.from(container.querySelectorAll('.location-card')).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    ).length;
    container.style.display = visibleCards === 0 ? 'none' : 'block';
  });
}

function expandMatchingDistricts() {
  document.querySelectorAll('.district-container').forEach(container => {
    const hasVisibleCards = Array.from(container.querySelectorAll('.location-card')).some(card => 
      window.getComputedStyle(card).display !== 'none'
    );
    if (hasVisibleCards) {
      container.classList.remove('collapsed');
      container.querySelector('.district-header').classList.remove('collapsed');
    }
  });
}

// Function to scroll to and highlight a specific church card
function navigateToChurch(churchId) {
  event.preventDefault(); // Prevent default anchor behavior
  const card = document.querySelector(`[data-church-id="${churchId}"]`);
  if (card) {
    // Remove highlight from any previously highlighted cards
    document.querySelectorAll('.location-card').forEach(c => {
      c.classList.remove('highlight');
    });

    // Expand the district container if it's collapsed
    const districtContainer = card.closest('.district-container');
    if (districtContainer) {
      collapseAllDistricts();
      districtContainer.classList.remove('collapsed');
      districtContainer.querySelector('.district-header').classList.remove('collapsed');
    }

    // Add highlight class before scrolling
    card.classList.add('highlight');

    // Wait a brief moment for the container to expand
    setTimeout(() => {
      // Scroll the card into view with offset for header
      const headerHeight = document.querySelector('header').offsetHeight;
      const cardTop = card.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
      
      window.scrollTo({
        top: cardTop,
        behavior: 'smooth'
      });

      // Remove highlight class after animation
      setTimeout(() => {
        card.classList.remove('highlight');
      }, 3000);
    }, 100); // Small delay to ensure container is expanded
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Region button click handler
  regionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      regionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRegion = btn.dataset.region;
      filterByRegionAndSearch();
    });
  });

  // Search input handler
  searchInput.addEventListener('input', () => {
    filterByRegionAndSearch();
  });

  // District header click handler
  districtHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const container = header.closest('.district-container');
      const isCollapsed = container.classList.contains('collapsed');
      
      // Close all containers first
      document.querySelectorAll('.district-container').forEach(cont => {
        cont.classList.add('collapsed');
        cont.classList.remove('active');
        cont.querySelector('.district-header').classList.add('collapsed');
      });

      if (isCollapsed) {
        // Open clicked container
        container.classList.remove('collapsed');
        container.classList.add('active');
        header.classList.remove('collapsed');
        
        // Scroll into view if needed
        const headerHeight = document.querySelector('header').offsetHeight;
        const containerTop = container.getBoundingClientRect().top + window.pageYOffset;
        
        if (containerTop < window.pageYOffset + headerHeight) {
          window.scrollTo({
            top: containerTop - headerHeight - 20,
            behavior: 'smooth'
          });
        }
      } else {
        // Close clicked container
        container.classList.add('collapsed');
        container.classList.remove('active');
        header.classList.add('collapsed');
      }
    });
  });

  // Contact button functionality
  const contactBtns = document.querySelectorAll('.contact-btn');
  contactBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.closest('.location-card').querySelector('.detail-item:nth-child(2) span').textContent;
      window.location.href = `tel:${phone}`;
    });
  });

  // Initialize the page
  sortAlphabetically();
  collapseAllDistricts();
  filterByRegionAndSearch();
});