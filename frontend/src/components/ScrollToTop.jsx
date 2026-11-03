// =============================================================
// frontend/src/components/ScrollToTop.jsx  —  every new page starts at the top
// =============================================================
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
  }, [pathname]);
  return null;
}

export default ScrollToTop;