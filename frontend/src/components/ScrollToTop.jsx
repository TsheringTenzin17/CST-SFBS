// =============================================================
// frontend/src/components/ScrollToTop.jsx  —  every new page starts at the top
// =============================================================
import { useEffect } from 'react';                    // Bring in the useEffect hook from React
import { useLocation } from 'react-router-dom';       // Bring in the useLocation hook to read the current URL

// ----- ScrollToTop component -----

// Scrolls the page to the top every time the URL path changes
function ScrollToTop() {                              // Component with no props
  const { pathname } = useLocation();                 // Get the current path (like "/home") from the router

  // ----- Effect: scroll up when the path changes -----
  useEffect(() => {                        // Run this code after the page path changes
    window.scrollTo({                      // Tell the browser window to scroll
      top: 0,                              // Go to the very top (0 pixels down)
      left: 0,                             // Go to the very left (0 pixels across)
      behavior: 'smooth',                  // Scroll slowly and smoothly, not with a jump
    });                                    // End of the scroll options
  }, [pathname]);                          // Only run again when pathname changes

  return null;              // Show nothing on the screen; this component only does work
}                           // End of ScrollToTop

export default ScrollToTop;          // Let other files import this component