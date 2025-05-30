import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@renderer/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', {
    variants: {
        variant: {
            default: 'border-transparent bg-green-400/20 text-green-400 shadow hover:bg-green-400/50',
            secondary: 'border-transparent bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/50',
            destructive: 'border-transparent bg-red-400/20 text-red-400 shadow hover:bg-red-400/50',
            outline: 'text-foreground',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
