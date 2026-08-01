import React from 'react';

export function NotionIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l11.613-.701c.234 0 .42-.14.42-.42 0-.233-.14-.42-.373-.42l-2.613-.187c-.746-.046-1.166-.373-1.166-1.026 0-.14.046-.326.14-.513L16.23.233c.187-.326.046-.513-.28-.513L4.972.42c-.653.047-1.12.327-1.12.933 0 .14.047.327.14.514l1.353 2.341h-.886zm2.288 3.824v13.52c0 .887.42 1.353 1.353 1.353.467 0 .933-.093 1.586-.28l8.677-2.613c.886-.28 1.306-.793 1.306-1.633V4.86c0-.513-.233-.793-.746-.746l-10.726.653c-.979.047-1.45.607-1.45 1.519zm3.871 1.773c.14 0 .327.093.42.233l4.665 7.417V10.27c0-.28.187-.466.467-.466h1.213c.28 0 .466.186.466.466v9.33c0 .28-.14.42-.373.42-.14 0-.327-.093-.42-.233l-4.759-7.558V19.46c0 .28-.187.466-.467.466h-1.213c-.28 0-.466-.186-.466-.466v-9.33c0-.28.186-.466.466-.466h.466z" />
    </svg>
  );
}

export function OneDriveIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="#0078D4"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none">
      <path d="M6.6 66.85l13.85-24 28.55 49.45h-27.7z" fill="#0066DA" />
      <path d="M43.65 0l28.55 49.45h-57.1z" fill="#00AC47" />
      <path d="M73.95 66.85l-13.85-24h27.2l13.85 24z" fill="#EA4335" />
      <path d="M43.65 0l13.85 24-28.55 49.45-13.85-24z" fill="#FFBA00" />
    </svg>
  );
}

export function GmailIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleCalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" />
      <path d="M3 8h18V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2z" fill="#185ABC" />
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
        31
      </text>
    </svg>
  );
}

export function SlackIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A" />
      <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#36C5F0" />
      <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#2EB67D" />
      <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" fill="#ECB22E" />
      <path d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

export function SupabaseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M13.35 24v-9.75h9.15L10.65 0v9.75H1.5l11.85 14.25z" fill="#3ECF8E" />
    </svg>
  );
}
