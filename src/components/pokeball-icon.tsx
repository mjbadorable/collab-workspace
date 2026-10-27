// Mini Pokéball used as the brand mark (login, sidebar workspace avatar).
export default function PokeballIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#171717" strokeWidth="1.75" />
      <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" fill="#dc2626" stroke="#171717" strokeWidth="1.75" strokeLinejoin="round" />
      <line x1="1.5" y1="12" x2="22.5" y2="12" stroke="#171717" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.25" fill="#fff" stroke="#171717" strokeWidth="1.75" />
    </svg>
  );
}
