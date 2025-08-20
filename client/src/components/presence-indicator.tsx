interface PresenceIndicatorProps {
  status: 'online' | 'offline' | 'in-your-chat';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PresenceIndicator({ status, size = 'md', className = '' }: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4'
  };

  const statusClasses = {
    online: 'bg-yellow-500', // Giallo = attivo nel programma
    offline: 'bg-red-500',   // Rosso = non attivo
    'in-your-chat': 'bg-green-500' // Verde = nella tua chat
  };

  return (
    <div 
      className={`rounded-full ${sizeClasses[size]} ${statusClasses[status]} border-2 border-white dark:border-gray-800 ${className}`}
      title={
        status === 'online' ? 'Attivo nel programma' :
        status === 'offline' ? 'Non attivo' :
        'Nella tua chat'
      }
    />
  );
}