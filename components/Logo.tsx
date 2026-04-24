import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  size?: number;
  showText?: boolean;
}

export default function Logo({
  href = '/',
  onClick,
  className = '',
  size = 32,
  showText = true,
}: LogoProps) {
  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/NoFish-logo.png"
        alt="NoFish"
        width={size}
        height={size}
        className="rounded-full shrink-0"
      />
      {showText && <span className="font-bold whitespace-nowrap shrink-0">NoFish</span>}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center shrink-0 bg-transparent border-0 p-0 m-0 appearance-none cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="NoFish home"
        title="Go to home"
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className="flex items-center gap-2 text-gray-800 hover:text-maritime-teal-700 no-underline transition-colors">
      {content}
    </Link>
  );
}
