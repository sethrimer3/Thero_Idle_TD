const tabs = document.querySelectorAll('.tab-button');
const panels = document.querySelectorAll('.panel');

function setActiveTab(target) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === target;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', isActive);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === target);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const { tab: target } = tab.dataset;
    setActiveTab(target);
  });
});

// keyboard navigation for accessibility
let focusedIndex = 0;

tabs.forEach((tab, index) => {
  tab.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusedIndex = index;
      if (event.key === 'ArrowRight') {
        focusedIndex = (focusedIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        focusedIndex = (focusedIndex - 1 + tabs.length) % tabs.length;
      }
      tabs[focusedIndex].focus();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = tabs[focusedIndex].dataset.tab;
      setActiveTab(target);
    }
  });
});

setActiveTab('tower');
