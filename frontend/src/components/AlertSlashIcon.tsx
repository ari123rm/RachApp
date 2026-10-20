// src/components/AlertSlashIcon.tsx
interface AlertSlashIconProps {
  size?: number;
  className?: string;
}

export function AlertSlashIcon({ size = 20, className = 'text-gray-400' }: AlertSlashIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Círculo do alerta */}
      <circle cx="12" cy="12" r="10" />
      {/* Ponto superior da exclamação */}
      <line x1="12" y1="8" x2="12" y2="12" />
      {/* Ponto inferior da exclamação */}
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" />
      {/* Traço/Corte diagonal sobre o alerta */}
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export default AlertSlashIcon;
