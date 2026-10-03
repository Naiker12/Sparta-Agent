import { useEffect, useRef, useState, type RefObject } from 'react';

/** Follow streamed content only while the reader remains near the bottom. */
export function useDemoAutoscroll(pane: RefObject<HTMLDivElement | null>, active: boolean) {
  const following = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const element = pane.current;
    if (!element || !active) { setShowJump(false); return; }
    following.current = true;
    const readPosition = () => {
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      setShowJump(!following.current);
    };
    const resize = new ResizeObserver(() => {
      if (following.current) element.scrollTop = element.scrollHeight;
      setShowJump(element.scrollHeight - element.scrollTop - element.clientHeight >= 48);
    });
    const content = element.querySelector('.preview-messages');
    if (content) resize.observe(content);
    element.addEventListener('scroll', readPosition, { passive: true });
    return () => { resize.disconnect(); element.removeEventListener('scroll', readPosition); };
  }, [pane, active]);
  const jump = () => {
    following.current = true;
    pane.current?.scrollTo({ top: pane.current.scrollHeight, behavior: 'instant' });
    setShowJump(false);
  };
  return { showJump, jump };
}
