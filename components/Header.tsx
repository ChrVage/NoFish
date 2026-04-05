interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

export default function Header({ children, className }: HeaderProps) {
  return (
    <header className={`bg-white text-gray-800 py-3 px-6 shadow${className ? ` ${className}` : ''}`}>
      {children}
    </header>
  );
}
