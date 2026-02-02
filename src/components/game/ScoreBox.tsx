import { cn } from '@/lib/utils';

interface ScoreBoxProps {
  label: string;
  score: number;
  variant?: 'primary' | 'secondary';
}

export const ScoreBox = ({ label, score, variant = 'primary' }: ScoreBoxProps) => {
  return (
    <div
      className={cn(
        'rounded-lg px-4 py-3 text-center min-w-[100px]',
        variant === 'primary' 
          ? 'gradient-primary glow-primary' 
          : 'bg-secondary'
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
        {label}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-primary-foreground">
        {score.toLocaleString()}
      </div>
    </div>
  );
};
