/** @jsxImportSource preact */
// Shell icons (inline SVG, currentColor).
const Svg = ({ children, className = 'w-5 h-5', strokeWidth = 2 }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {children}
    </svg>
);

export const ChatIcon = (p) => (
    <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width={3} /></Svg>
);
export const CloseIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const SendIcon = (p) => <Svg {...p}><path d="M5 12h13M13 6l6 6-6 6" /></Svg>;
export const TrashIcon = (p) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;
export const BotIcon = (p) => (
    <Svg {...p}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01" /><path d="M2 13v2M22 13v2" /></Svg>
);
